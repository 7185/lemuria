import {Lexer} from 'chevrotain'
import {colorStringToRGB} from './color-utils'
import {ActionParser, allTokens} from './action-parser'
import type {
  ActionCtx,
  ActionsCtx,
  BcolorParameterCtx,
  ColorCommandCtx,
  ColorParameterCtx,
  CommandCtx,
  MaskParameterCtx,
  MediaCommandCtx,
  NameParameterCtx,
  PictureArgsCtx,
  PictureCommandCtx,
  SignArgsCtx,
  SignCommandCtx,
  SolidCommandCtx,
  TagParameterCtx,
  TeleportCommandCtx,
  TextureArgsCtx,
  TextureCommandCtx,
  TriggerCtx,
  UpdateParameterCtx,
  VisibleCommandCtx
} from './action-models'

const parserInstance = new ActionParser()
const BaseActionVisitor = parserInstance.getBaseCstVisitorConstructor()

class ActionVisitor extends BaseActionVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  boolean(ctx: any) {
    if (ctx.Enabled) {
      return true
    }
    if (ctx.Disabled) {
      return false
    }
    return null
  }

  colorCommand(ctx: ColorCommandCtx) {
    const result = {
      commandType: 'color',
      color: colorStringToRGB(
        ctx.Resource.map((identToken) => identToken.image)[0]
      )
    }
    return result.color == null ? null : result
  }

  examineCommand() {
    return {
      commandType: 'examine'
    }
  }

  mediaCommand(ctx: MediaCommandCtx) {
    return {
      commandType: 'media',
      resource: ctx.Resource.map((identToken) => identToken.image)[0]
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
    let text = ctx.Resource?.map((identToken) => identToken.image)[0]
    if (text != null) {
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
    const paramName = ctx.Name[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  maskParameter(ctx: MaskParameterCtx) {
    const paramName = ctx.Mask[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  tagParameter(ctx: TagParameterCtx) {
    const paramName = ctx.Tag[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: paramValue}
  }

  updateParameter(ctx: UpdateParameterCtx) {
    const paramName = ctx.Update[0].image
    const paramValue = ctx.Resource[0].image
    return {[paramName]: parseInt(paramValue)}
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
    return {
      commandType: 'solid',
      value: this.visit(ctx.boolean)
    }
  }

  visibleCommand(ctx: VisibleCommandCtx) {
    return {
      commandType: 'visible',
      value: this.visit(ctx.boolean)
    }
  }

  teleportCommand(ctx: TeleportCommandCtx) {
    const worldName = ctx.Resource.map((identToken) => identToken.image)[0]
    if (/^\d/.test(worldName)) {
      return null
    }
    return {
      commandType: 'teleport',
      worldName
    }
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

  command(ctx: CommandCtx) {
    return this.visit(
      ctx.colorCommand ||
        ctx.examineCommand ||
        ctx.solidCommand ||
        ctx.visibleCommand ||
        ctx.mediaCommand ||
        ctx.pictureCommand ||
        ctx.signCommand ||
        ctx.teleportCommand ||
        ctx.textureCommand
    )
  }

  trigger(ctx: TriggerCtx) {
    return (ctx.Create || ctx.Activate || ctx.Bump)[0].image.toLowerCase()
  }

  action(ctx: ActionCtx) {
    const type = this.visit(ctx.trigger)
    const commands = ctx.command.map((command) => this.visit(command))
    const result: any = {}

    // Filter out duplicate commands of the same type, keeping only the last one
    const commandMap = new Map<string, any>()
    for (const command of commands) {
      if (command != null) {
        commandMap.set(command.commandType, command)
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
      if (!actionsMap.has(action.type)) {
        actionsMap.set(action.type, action)
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
      ensureOptimizations: false,
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
