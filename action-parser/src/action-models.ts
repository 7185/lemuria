import {CstNode, IToken} from 'chevrotain'

export interface BooleanCtx {
  Enabled: IToken[]
  Disabled: IToken[]
}
export interface ColorCommandCtx {
  Resource: IToken[]
  nameParameter?: CstNode[]
}

export interface NameCommandCtx {
  Resource: IToken[]
}

export interface MediaCommandCtx {
  Resource: IToken[]
}

export interface MoveCommandCtx {
  Resource: IToken[]
  moveArgs?: CstNode[]
}

export interface PictureCommandCtx {
  Resource: IToken[]
  pictureArgs?: CstNode[]
}

export interface RotateCommandCtx {
  Resource: IToken[]
  moveArgs?: CstNode[]
}

export interface SignCommandCtx {
  Resource: IToken[]
  signArgs?: CstNode[]
}

export interface TextureCommandCtx {
  Resource: IToken[]
  textureArgs?: CstNode[]
}

export interface TeleportCommandCtx {
  Resource: IToken[]
}

export interface SolidCommandCtx {
  boolean: CstNode[]
}

export interface VisibleCommandCtx {
  boolean: CstNode[]
}

export interface CommandCtx {
  colorCommand: CstNode[]
  examineCommand: CstNode[]
  solidCommand: CstNode[]
  visibleCommand: CstNode[]
  mediaCommand: CstNode[]
  moveCommand: CstNode[]
  nameCommand: CstNode[]
  pictureCommand: CstNode[]
  rotateCommand: CstNode[]
  signCommand: CstNode[]
  teleportCommand: CstNode[]
  textureCommand: CstNode[]
}

export interface TriggerCtx {
  Create: IToken[]
  Activate: IToken[]
  Bump: IToken[]
}

export interface ActionCtx {
  trigger: CstNode[]
  command: CstNode[]
}

export interface ActionsCtx {
  action: CstNode[]
}

export interface ColorParameterCtx {
  Color: IToken[]
  Resource: IToken[]
}

export interface BcolorParameterCtx {
  Bcolor: IToken[]
  Resource: IToken[]
}

export interface NameParameterCtx {
  Name: IToken[]
  Resource: IToken[]
}

export interface MaskParameterCtx {
  Mask: IToken[]
  Resource: IToken[]
}

export interface TagParameterCtx {
  Tag: IToken[]
  Resource: IToken[]
}

export interface TimeParameterCtx {
  Time: IToken[]
  Resource: IToken[]
}

export interface UpdateParameterCtx {
  Update: IToken[]
  Resource: IToken[]
}

export interface WaitParameterCtx {
  Wait: IToken[]
  Resource: IToken[]
}

export interface PictureArgsCtx {
  nameParameter?: CstNode[]
  updateParameter?: CstNode[]
}

export interface MoveArgsCtx {
  waitParameter?: CstNode[]
  timeParameter?: CstNode[]
  nameParameter?: CstNode[]
  Loop?: IToken[]
  Reset?: IToken[]
}
export interface SignArgsCtx {
  colorParameter?: CstNode[]
  bcolorParameter?: CstNode[]
  nameParameter?: CstNode[]
}

export interface TextureArgsCtx {
  maskParameter?: CstNode[]
  nameParameter?: CstNode[]
  tagParameter?: CstNode[]
}
