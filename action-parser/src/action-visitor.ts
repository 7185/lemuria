import {CstNode, IToken, Lexer} from 'chevrotain'
import {colorStringToRGB, visitCoords} from './action-utils'
import {ActionParser, allTokens} from './action-parser'
import type {
  ActionCtx,
  ActionsCtx,
  AngleParameterCtx,
  BcolorParameterCtx,
  BooleanCtx,
  BrightnessParameterCtx,
  ColorCommandCtx,
  ColorParameterCtx,
  CommandCtx,
  CoronaArgsCtx,
  CoronaCommandCtx,
  FxParameterCtx,
  LightArgsCtx,
  LightCommandCtx,
  MaskParameterCtx,
  MediaArgsCtx,
  MediaCommandCtx,
  MoveArgsCtx,
  MoveCommandCtx,
  NameCommandCtx,
  NameParameterCtx,
  NoiseCommandCtx,
  PictureArgsCtx,
  PictureCommandCtx,
  PitchParameterCtx,
  RadiusParameterCtx,
  RotateCommandCtx,
  SignArgsCtx,
  SignCommandCtx,
  SizeParameterCtx,
  SolidCommandCtx,
  SoundCommandCtx,
  TagParameterCtx,
  TeleportCommandCtx,
  TextureArgsCtx,
  TextureCommandCtx,
  TimeParameterCtx,
  TriggerCtx,
  TypeParameterCtx,
  UpdateParameterCtx,
  UrlCommandCtx,
  VisibleCommandCtx,
  WaitParameterCtx,
  WarpCommandCtx
} from './action-models'

const parserInstance = new ActionParser()
const BaseActionVisitor = parserInstance.getBaseCstVisitorConstructor()

class ActionVisitor extends BaseActionVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  boolean(ctx: BooleanCtx) {
    if (ctx.Enabled) {
      return true
    }
    if (ctx.Disabled) {
      return false
    }
  }

  colorCommand(ctx: ColorCommandCtx) {
    const result: any = {
      commandType: 'color',
      color: colorStringToRGB(
        ctx.Resource.map((identToken) => identToken.image)[0]
      )
    }
    if (ctx.nameParameter != null) {
      result.targetName = (
        ctx.nameParameter[0].children.Resource[0] as IToken
      ).image
    }
    return result.color == null ? null : result
  }

  examineCommand() {
    return {
      commandType: 'examine'
    }
  }

  mediaCommand(ctx: MediaCommandCtx) {
    const res: object = {
      commandType: 'media',
      resource: ctx.Resource.map((identToken) => identToken.image)[0]
    }
    const args = ctx.mediaArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  nameCommand(ctx: NameCommandCtx) {
    return {
      commandType: 'name',
      targetName: ctx.Resource.map((identToken) => identToken.image)[0]
    }
  }

  lightCommand(ctx: LightCommandCtx) {
    const res = {
      commandType: 'light'
    }
    const args = ctx.lightArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  coronaCommand(ctx: CoronaCommandCtx) {
    const res = {
      commandType: 'corona',
      resource: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
    const args = ctx.coronaArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  noiseCommand(ctx: NoiseCommandCtx) {
    return {
      commandType: 'noise',
      targetName: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
  }
  soundCommand(ctx: SoundCommandCtx) {
    return {
      commandType: 'sound',
      targetName: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
  }

  urlCommand(ctx: UrlCommandCtx) {
    return {
      commandType: 'url',
      resource: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
  }

  pictureCommand(ctx: PictureCommandCtx) {
    const res: object = {
      commandType: 'picture',
      resource: ctx.Resource.map((identToken) => identToken.image)[0]
    }
    const args = ctx.pictureArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  signCommand(ctx: SignCommandCtx) {
    let res: object = {
      commandType: 'sign'
    }
    const args = ctx.signArgs?.map((arg) => this.visit(arg))[0]
    const resource = ctx.Resource?.map((identToken) => identToken.image)
    if (resource != null) {
      let text = ''
      if (resource.length > 1) {
        if (resource[0].startsWith('"')) {
          text = resource.join(' ')
        } else {
          // invalid sign
          return {}
        }
      } else {
        text = resource[0]
      }
      text = text.replace(/(^"|"$)/g, '')
      res = {
        commandType: 'sign',
        text
      }
    }
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  colorParameter(ctx: ColorParameterCtx) {
    const paramName = ctx.Color[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: colorStringToRGB(paramValue)}
  }

  bcolorParameter(ctx: BcolorParameterCtx) {
    const paramName = ctx.Bcolor[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: colorStringToRGB(paramValue)}
  }

  nameParameter(ctx: NameParameterCtx) {
    const paramValue = ctx.Resource[0].image
    return {targetName: paramValue}
  }

  maskParameter(ctx: MaskParameterCtx) {
    const paramName = ctx.Mask[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  timeParameter(ctx: TimeParameterCtx) {
    const paramName = ctx.Time[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  waitParameter(ctx: WaitParameterCtx) {
    const paramName = ctx.Wait[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  angleParameter(ctx: AngleParameterCtx) {
    const paramName = ctx.Angle[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  brightnessParameter(ctx: BrightnessParameterCtx) {
    const paramName = ctx.Brightness[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  pitchParameter(ctx: PitchParameterCtx) {
    const paramName = ctx.Pitch[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  radiusParameter(ctx: RadiusParameterCtx) {
    const paramName = ctx.Radius[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  sizeParameter(ctx: SizeParameterCtx) {
    const paramName = ctx.Size[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  tagParameter(ctx: TagParameterCtx) {
    const paramName = ctx.Tag[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  typeParameter(ctx: TypeParameterCtx) {
    const paramName = ctx.Type[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  fxParameter(ctx: FxParameterCtx) {
    const paramName = ctx.Fx[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  updateParameter(ctx: UpdateParameterCtx) {
    const paramName = ctx.Update[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseInt(paramValue)}
  }

  coronaArgs(ctx: CoronaArgsCtx) {
    const args = []
    if (ctx.maskParameter) {
      args.push(this.visit(ctx.maskParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    if (ctx.sizeParameter) {
      args.push(this.visit(ctx.sizeParameter))
    }
    return args
  }

  lightArgs(ctx: LightArgsCtx) {
    const args = []
    if (ctx.angleParameter) {
      args.push(this.visit(ctx.angleParameter))
    }
    if (ctx.brightnessParameter) {
      args.push(this.visit(ctx.brightnessParameter))
    }
    if (ctx.colorParameter) {
      args.push(this.visit(ctx.colorParameter))
    }
    if (ctx.fxParameter) {
      args.push(this.visit(ctx.fxParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    if (ctx.pitchParameter) {
      args.push(this.visit(ctx.pitchParameter))
    }
    if (ctx.radiusParameter) {
      args.push(this.visit(ctx.radiusParameter))
    }
    if (ctx.timeParameter) {
      args.push(this.visit(ctx.timeParameter))
    }
    if (ctx.typeParameter) {
      args.push(this.visit(ctx.typeParameter))
    }
    return args
  }

  pictureArgs(ctx: PictureArgsCtx) {
    const args = []
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    if (ctx.updateParameter) {
      args.push(this.visit(ctx.updateParameter))
    }
    return args
  }

  mediaArgs(ctx: MediaArgsCtx) {
    const args = []
    if (ctx.radiusParameter) {
      args.push(this.visit(ctx.radiusParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    return args
  }

  moveArgs(ctx: MoveArgsCtx) {
    const args = []
    if (ctx.timeParameter) {
      args.push(this.visit(ctx.timeParameter))
    }
    if (ctx.waitParameter) {
      args.push(this.visit(ctx.waitParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    if (ctx.Loop) {
      args.push({loop: !ctx.Loop[0].image.startsWith('no')})
    }
    if (ctx.Reset) {
      args.push({reset: !ctx.Reset[0].image.startsWith('no')})
    }
    if (ctx.Sync) {
      args.push({sync: !ctx.Sync[0].image.startsWith('no')})
    }
    return args
  }

  signArgs(ctx: SignArgsCtx) {
    const args = []
    if (ctx.colorParameter) {
      args.push(this.visit(ctx.colorParameter))
    }
    if (ctx.bcolorParameter) {
      args.push(this.visit(ctx.bcolorParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    return args
  }

  textureArgs(ctx: TextureArgsCtx) {
    const args = []
    if (ctx.maskParameter) {
      args.push(this.visit(ctx.maskParameter))
    }
    if (ctx.nameParameter) {
      args.push(this.visit(ctx.nameParameter))
    }
    if (ctx.tagParameter) {
      args.push(this.visit(ctx.tagParameter))
    }
    return args
  }

  solidCommand(ctx: SolidCommandCtx) {
    const res = {
      commandType: 'solid',
      value: this.visit(ctx.boolean)
    }
    if (ctx.Resource != null) {
      Object.assign(res, {
        targetName: ctx.Resource.map((identToken) => identToken.image)[0]
      })
    }
    return res
  }

  visibleCommand(ctx: VisibleCommandCtx) {
    const res = {
      commandType: 'visible',
      value: this.visit(ctx.boolean)
    }
    if (ctx.Resource != null) {
      Object.assign(res, {
        targetName: ctx.Resource.map((identToken) => identToken.image)[0]
      })
    }
    return res
  }

  teleportCommand(ctx: TeleportCommandCtx) {
    if (ctx.Resource == null) {
      return null
    }

    const res: any = {
      commandType: 'teleport'
    }

    let [worldName, coordA, coordB, coordC, coordD] = ctx.Resource.map(
      (identToken: IToken) => identToken.image
    )
    if (/^[+-\d]/.test(worldName)) {
      // Relative teleport
      coordD = coordC
      coordC = coordB
      coordB = coordA
      coordA = worldName
      worldName = 'nowhere'
    } else {
      Object.assign(res, {worldName})
      if (coordA == null) {
        // World name only
        return res
      }
    }
    visitCoords(res, coordA, coordB, coordC, coordD)

    return res
  }

  warpCommand(ctx: WarpCommandCtx) {
    if (ctx.Resource == null || ctx.Resource.length < 2) {
      return null
    }

    const res = {
      commandType: 'warp',
      coordinates: {}
    }
    const [coordA, coordB, coordC, coordD] = ctx.Resource.map(
      (identToken: IToken) => identToken.image
    )
    visitCoords(res, coordA, coordB, coordC, coordD)

    return res
  }

  textureCommand(ctx: TextureCommandCtx) {
    const res: object = {
      commandType: 'texture',
      texture: ctx.Resource.map((identToken) => identToken.image)[0]
    }
    const args = ctx.textureArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  moveCommand(ctx: MoveCommandCtx) {
    if (ctx.Resource == null) {
      return {}
    }

    const res = {
      commandType: 'move',
      distance: {x: 0, y: 0, z: 0}
    }

    if (ctx.Resource.length === 1) {
      res.distance.y = parseFloat(ctx.Resource[0].image)
    } else if (ctx.Resource.length === 2) {
      res.distance.x = parseFloat(ctx.Resource[0].image)
      res.distance.y = parseFloat(ctx.Resource[1].image)
    } else if (ctx.Resource.length === 3) {
      res.distance.x = parseFloat(ctx.Resource[0].image)
      res.distance.y = parseFloat(ctx.Resource[1].image)
      res.distance.z = parseFloat(ctx.Resource[2].image)
    }

    const args = ctx.moveArgs?.map((arg: CstNode) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  rotateCommand(ctx: RotateCommandCtx) {
    if (ctx.Resource == null) {
      return {}
    }

    const res = {
      commandType: 'rotate',
      speed: {x: 0, y: 0, z: 0}
    }

    if (ctx.Resource.length === 1) {
      res.speed.y = parseFloat(ctx.Resource[0].image)
    } else if (ctx.Resource.length === 2) {
      res.speed.x = parseFloat(ctx.Resource[0].image)
      res.speed.y = parseFloat(ctx.Resource[1].image)
    } else if (ctx.Resource.length === 3) {
      res.speed.x = parseFloat(ctx.Resource[0].image)
      res.speed.y = parseFloat(ctx.Resource[1].image)
      res.speed.z = parseFloat(ctx.Resource[2].image)
    }

    const args = ctx.moveArgs?.map((arg: CstNode) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  command(ctx: CommandCtx) {
    return this.visit(
      ctx.colorCommand ||
        ctx.coronaCommand ||
        ctx.examineCommand ||
        ctx.lightCommand ||
        ctx.mediaCommand ||
        ctx.moveCommand ||
        ctx.nameCommand ||
        ctx.noiseCommand ||
        ctx.pictureCommand ||
        ctx.rotateCommand ||
        ctx.signCommand ||
        ctx.solidCommand ||
        ctx.soundCommand ||
        ctx.teleportCommand ||
        ctx.textureCommand ||
        ctx.urlCommand ||
        ctx.visibleCommand ||
        ctx.warpCommand
    )
  }

  trigger(ctx: TriggerCtx) {
    return (ctx.Create ||
      ctx.Activate ||
      ctx.Bump ||
      ctx.Adone)[0].image.toLowerCase()
  }

  action(ctx: ActionCtx) {
    const type = this.visit(ctx.trigger)
    const commands = ctx.command.map((command) => this.visit(command))
    const result: any = {}

    // Filter out duplicate commands of the same type, keeping only the last one
    const commandMap = new Map<string, any>()
    for (const command of commands) {
      if (command != null && Object.keys(command).length) {
        // If targetName is present, duplicate commands are allowed
        // (except for the name command)
        let key = command.commandType
        if (key !== 'name' && command.targetName != null) {
          key += command.targetName
        }
        commandMap.set(key, command)
      }
    }
    if (commandMap.size) {
      result[type] = Array.from(commandMap.values())
    }

    return result
  }

  actions(ctx: ActionsCtx) {
    const actions = ctx.action.map((action) => this.visit(action))

    // Filter out duplicate actions of the same type, keeping only the first one
    const actionsMap = new Map<string, any>()
    for (const action of actions) {
      if (!actionsMap.has(Object.keys(action)[0])) {
        actionsMap.set(Object.keys(action)[0], action)
      }
    }

    return Object.assign({}, ...actionsMap.values())
  }
}

/**
 * Actual class to use in the client
 * Should be instanciated only once
 */
export class Action {
  private visitor: ActionVisitor
  private lexer: Lexer

  constructor() {
    this.visitor = new ActionVisitor()
    this.lexer = new Lexer(allTokens, {
      ensureOptimizations: true,
      skipValidations: false
    })
  }

  public parse(inputText: string) {
    const lexResult = this.lexer.tokenize(inputText)
    parserInstance.input = lexResult.tokens

    const cst = parserInstance.actions()
    if (parserInstance.errors.length > 0) {
      return {}
    }
    return this.visitor.visit(cst)
  }

  public debug(inputText: string) {
    const lexResult = this.lexer.tokenize(inputText)
    parserInstance.input = lexResult.tokens

    parserInstance.actions()
    if (parserInstance.errors.length > 0) {
      return parserInstance.errors[0].message
    }
    return 'OK'
  }
}
