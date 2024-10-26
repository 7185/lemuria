import {CstNode, IToken, Lexer} from 'chevrotain'
import {colorStringToRGB, visitCoords} from './action.utils'
import {ActionParser, allTokens} from './action.parser'
import type {
  ActionCtx,
  ActionsCtx,
  AngleParameterCtx,
  AnimateCommandCtx,
  AstartCommandCtx,
  AstopCommandCtx,
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
} from './action.interfaces'

const parserInstance = new ActionParser()
const BaseActionVisitor = parserInstance.getBaseCstVisitorConstructor()

class ActionVisitor extends BaseActionVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  // Commands

  animateCommand(ctx: AnimateCommandCtx) {
    const res = {
      commandType: 'animate',
      mask: false // default
    }
    if (ctx.Mask != null) {
      res.mask = true
    }
    if (ctx.tagParameter) {
      Object.assign(res, this.visit(ctx.tagParameter))
    }
    const params = ctx.Resource.map((identToken) => identToken.image)
    if (params.length < 5) {
      return {}
    }
    Object.assign(res, {
      targetName: params.shift(),
      animation: params.shift()
    })
    if (params.some((value) => !/^\d+$/.test(value))) {
      return {}
    }
    Object.assign(res, {
      imageCount: parseInt(params.shift() as string),
      frameCount: parseInt(params.shift() as string),
      frameDelay: parseInt(params.shift() as string),
      frameList: params.map((f: string) => parseInt(f))
    })
    return res
  }

  astartCommand(ctx: AstartCommandCtx) {
    const res = {
      commandType: 'astart'
    }
    if (ctx.Resource != null) {
      Object.assign(res, {
        targetName: ctx.Resource.map((identToken) => identToken.image)[0]
      })
    }
    if (ctx.boolean != null) {
      Object.assign(res, {
        loop: this.visit(ctx.boolean)
      })
    }
    return res
  }

  astopCommand(ctx: AstopCommandCtx) {
    const res = {
      commandType: 'astop'
    }
    if (ctx.Resource != null) {
      Object.assign(res, {
        targetName: ctx.Resource.map((identToken) => identToken.image)[0]
      })
    }
    return res
  }

  colorCommand(ctx: ColorCommandCtx) {
    const res = {
      commandType: 'color',
      color: colorStringToRGB(
        ctx.Resource.map((identToken) => identToken.image)[0]
      )
    }
    if (ctx.nameParameter != null) {
      Object.assign(res, {
        targetName: (ctx.nameParameter[0].children.Resource[0] as IToken).image
      })
    }
    return res.color == null ? null : res
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

  examineCommand() {
    return {
      commandType: 'examine'
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

  mediaCommand(ctx: MediaCommandCtx) {
    const res = {
      commandType: 'media',
      url: ctx.Resource.map((identToken) => identToken.image)[0]
    }
    const args = ctx.mediaArgs?.map((arg) => this.visit(arg))[0]
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
  }

  moveCommand(ctx: MoveCommandCtx) {
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

  nameCommand(ctx: NameCommandCtx) {
    return {
      commandType: 'name',
      targetName: ctx.Resource.map((identToken) => identToken.image)[0]
    }
  }

  noiseCommand(ctx: NoiseCommandCtx) {
    return {
      commandType: 'noise',
      resource: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
  }

  pictureCommand(ctx: PictureCommandCtx) {
    const res = {
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

  rotateCommand(ctx: RotateCommandCtx) {
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

  signCommand(ctx: SignCommandCtx) {
    const res = {
      commandType: 'sign'
    }
    const args = ctx.signArgs?.map((arg) => this.visit(arg))[0]
    const resource = ctx.Resource?.map((identToken) => identToken.image)
    if (resource != null) {
      let text = ''
      if (resource.length > 1) {
        if (!resource[0].startsWith('"')) {
          // invalid sign
          return {}
        }
        text = resource.join(' ')
      } else {
        text = resource[0]
      }
      text = text.replace(/(^"|"$)/g, '')
      Object.assign(res, {text})
    }
    if (args != null) {
      args.forEach((arg: object) => {
        Object.assign(res, arg)
      })
    }
    return res
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

  soundCommand(ctx: SoundCommandCtx) {
    return {
      commandType: 'sound',
      resource: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
  }

  teleportCommand(ctx: TeleportCommandCtx) {
    const res = {
      commandType: 'teleport'
    }
    const resource = ctx.Resource.map((identToken: IToken) => identToken.image)
    const worldName = resource[0]
    let [, coordA, coordB, coordC, coordD] = resource

    if (/^[+-\d]/.test(worldName)) {
      // Relative teleport
      coordD = coordC
      coordC = coordB
      coordB = coordA
      coordA = worldName
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

  textureCommand(ctx: TextureCommandCtx) {
    const res = {
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

  urlCommand(ctx: UrlCommandCtx) {
    return {
      commandType: 'url',
      resource: ctx.Resource.map((identToken: IToken) => identToken.image)[0]
    }
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

  warpCommand(ctx: WarpCommandCtx) {
    if (ctx.Resource == null || ctx.Resource.length < 2) {
      return null
    }

    const res = {
      commandType: 'warp'
    }
    const [coordA, coordB, coordC, coordD] = ctx.Resource.map(
      (identToken: IToken) => identToken.image
    )
    visitCoords(res, coordA, coordB, coordC, coordD)

    return res
  }

  // Parameters

  angleParameter(ctx: AngleParameterCtx) {
    const paramName = ctx.Angle[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  bcolorParameter(ctx: BcolorParameterCtx) {
    const paramName = ctx.Bcolor[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: colorStringToRGB(paramValue)}
  }

  brightnessParameter(ctx: BrightnessParameterCtx) {
    const paramName = ctx.Brightness[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  colorParameter(ctx: ColorParameterCtx) {
    const paramName = ctx.Color[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: colorStringToRGB(paramValue)}
  }

  fxParameter(ctx: FxParameterCtx) {
    const paramName = ctx.Fx[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  maskParameter(ctx: MaskParameterCtx) {
    const paramName = ctx.Mask[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  nameParameter(ctx: NameParameterCtx) {
    const paramValue = ctx.Resource[0].image
    return {targetName: paramValue}
  }

  pitchParameter(ctx: PitchParameterCtx) {
    const paramName = ctx.Pitch[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  radiusParameter(ctx: RadiusParameterCtx) {
    const paramName = ctx.Radius[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  sizeParameter(ctx: SizeParameterCtx) {
    const paramName = ctx.Size[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  tagParameter(ctx: TagParameterCtx) {
    const paramName = ctx.Tag[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  timeParameter(ctx: TimeParameterCtx) {
    const paramName = ctx.Time[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  typeParameter(ctx: TypeParameterCtx) {
    const paramName = ctx.Type[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  updateParameter(ctx: UpdateParameterCtx) {
    const paramName = ctx.Update[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseInt(paramValue)}
  }

  waitParameter(ctx: WaitParameterCtx) {
    const paramName = ctx.Wait[0].image.toLowerCase()
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseFloat(paramValue)}
  }

  // Command args

  coronaArgs(ctx: CoronaArgsCtx) {
    const parameters: (keyof CoronaArgsCtx)[] = [
      'maskParameter',
      'nameParameter',
      'sizeParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
  }

  lightArgs(ctx: LightArgsCtx) {
    const parameters: (keyof LightArgsCtx)[] = [
      'angleParameter',
      'brightnessParameter',
      'colorParameter',
      'fxParameter',
      'nameParameter',
      'pitchParameter',
      'radiusParameter',
      'timeParameter',
      'typeParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
  }

  mediaArgs(ctx: MediaArgsCtx) {
    const parameters: (keyof MediaArgsCtx)[] = [
      'nameParameter',
      'radiusParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
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
      args.push({
        loop: !ctx.Loop[0].image.toLowerCase().startsWith('no')
      })
    }
    if (ctx.Reset) {
      args.push({
        reset: !ctx.Reset[0].image.toLowerCase().startsWith('no')
      })
    }
    if (ctx.Sync) {
      args.push({
        sync: !ctx.Sync[0].image.toLowerCase().startsWith('no')
      })
    }
    return args
  }

  pictureArgs(ctx: PictureArgsCtx) {
    const parameters: (keyof PictureArgsCtx)[] = [
      'nameParameter',
      'updateParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
  }

  signArgs(ctx: SignArgsCtx) {
    const parameters: (keyof SignArgsCtx)[] = [
      'colorParameter',
      'bcolorParameter',
      'nameParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
  }

  textureArgs(ctx: TextureArgsCtx) {
    const parameters: (keyof TextureArgsCtx)[] = [
      'maskParameter',
      'nameParameter',
      'tagParameter'
    ]
    return parameters
      .filter((param) => ctx[param])
      .map((param) => this.visit(ctx[param]!))
  }

  // Generic visitors

  boolean(ctx: BooleanCtx) {
    return !!ctx.Enabled
  }

  command(ctx: CommandCtx) {
    return this.visit(
      ctx.animateCommand ||
        ctx.astartCommand ||
        ctx.astopCommand ||
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
    const result: Record<string, object[]> = {}

    // Filter out duplicate commands of the same type, keeping only the last one
    const commandMap = new Map<string, object>()
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
    const actionsMap = new Map<string, object>()
    actions.forEach((action) => {
      const [key] = Object.keys(action)
      if (!actionsMap.has(key)) {
        actionsMap.set(key, action)
      }
    })

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

  parse(inputText: string) {
    const lexResult = this.lexer.tokenize(inputText ?? '')
    parserInstance.input = lexResult.tokens

    const cst = parserInstance.actions()
    if (parserInstance.errors.length > 0) {
      return {}
    }
    return this.visitor.visit(cst)
  }

  debug(inputText: string) {
    const lexResult = this.lexer.tokenize(inputText)
    parserInstance.input = lexResult.tokens

    parserInstance.actions()
    if (parserInstance.errors.length > 0) {
      return parserInstance.errors[0].message
    }
    return 'OK'
  }
}
