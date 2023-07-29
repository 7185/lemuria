import {CstNode, IToken} from 'chevrotain'

export interface ColorCommandCtx {
  Resource: IToken[]
}

export interface MediaCommandCtx {
  Resource: IToken[]
}

export interface PictureCommandCtx {
  Resource: IToken[]
  pictureArgs?: CstNode[]
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
  pictureCommand: CstNode[]
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

export interface UpdateParameterCtx {
  Update: IToken[]
  Resource: IToken[]
}

export interface PictureArgsCtx {
  nameParameter?: CstNode[]
  updateParameter?: CstNode[]
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
