import {CstNode, IToken} from 'chevrotain'

// Commands

export interface AnimateCommandCtx {
  Resource: IToken[]
  Mask?: IToken[]
  Nomask?: IToken[]
  tagParameter?: CstNode[]
}

export interface AstartCommandCtx {
  Resource?: IToken[]
  boolean: CstNode[]
}

export interface AstopCommandCtx {
  Resource?: IToken[]
}

export interface ColorCommandCtx {
  Resource: IToken[]
  nameParameter?: CstNode[]
}

export interface CoronaCommandCtx {
  Resource: IToken[]
  coronaArgs?: CstNode[]
}

export interface LightCommandCtx {
  lightArgs?: CstNode[]
}

export interface MediaCommandCtx {
  Resource: IToken[]
  mediaArgs?: CstNode[]
}

export interface MoveCommandCtx {
  Resource: IToken[]
  moveArgs?: CstNode[]
}

export interface NameCommandCtx {
  Resource: IToken[]
}

export interface NoiseCommandCtx {
  Resource: IToken[]
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

export interface SolidCommandCtx {
  Resource?: IToken[]
  boolean: CstNode[]
}
export interface SoundCommandCtx {
  Resource: IToken[]
}

export interface TeleportCommandCtx {
  Resource: IToken[]
}

export interface TextureCommandCtx {
  Resource: IToken[]
  textureArgs?: CstNode[]
}

export interface UrlCommandCtx {
  Resource: IToken[]
}

export interface VisibleCommandCtx {
  Resource?: IToken[]
  boolean: CstNode[]
}

export interface WarpCommandCtx {
  Resource: IToken[]
}

// Parameters

export interface AngleParameterCtx {
  Angle: IToken[]
  Resource: IToken[]
}

export interface BcolorParameterCtx {
  Bcolor: IToken[]
  Resource: IToken[]
}

export interface BrightnessParameterCtx {
  Brightness: IToken[]
  Resource: IToken[]
}

export interface ColorParameterCtx {
  Color: IToken[]
  Resource: IToken[]
}

export interface FxParameterCtx {
  Fx: IToken[]
  Resource: IToken[]
}

export interface MaskParameterCtx {
  Mask: IToken[]
  Resource: IToken[]
}

export interface NameParameterCtx {
  Name: IToken[]
  Resource: IToken[]
}

export interface PitchParameterCtx {
  Pitch: IToken[]
  Resource: IToken[]
}

export interface RadiusParameterCtx {
  Radius: IToken[]
  Resource: IToken[]
}

export interface SizeParameterCtx {
  Size: IToken[]
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

export interface TypeParameterCtx {
  Type: IToken[]
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

// Command args

export interface CoronaArgsCtx {
  maskParameter?: CstNode[]
  nameParameter?: CstNode[]
  sizeParameter?: CstNode[]
}

export interface LightArgsCtx {
  angleParameter?: CstNode[]
  brightnessParameter?: CstNode[]
  colorParameter?: CstNode[]
  fxParameter?: CstNode[]
  nameParameter?: CstNode[]
  pitchParameter?: CstNode[]
  radiusParameter?: CstNode[]
  timeParameter?: CstNode[]
  typeParameter?: CstNode[]
}

export interface MediaArgsCtx {
  nameParameter?: CstNode[]
  radiusParameter?: CstNode[]
}

export interface MoveArgsCtx {
  waitParameter?: CstNode[]
  timeParameter?: CstNode[]
  nameParameter?: CstNode[]
  Loop?: IToken[]
  Reset?: IToken[]
  Sync?: IToken[]
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

// Generic interfaces

export interface BooleanCtx {
  Enabled: IToken[]
  Disabled: IToken[]
}

export interface CommandCtx {
  animateCommand: CstNode[]
  astartCommand: CstNode[]
  astopCommand: CstNode[]
  colorCommand: CstNode[]
  coronaCommand: CstNode[]
  examineCommand: CstNode[]
  lightCommand: CstNode[]
  mediaCommand: CstNode[]
  moveCommand: CstNode[]
  nameCommand: CstNode[]
  noiseCommand: CstNode[]
  pictureCommand: CstNode[]
  rotateCommand: CstNode[]
  signCommand: CstNode[]
  solidCommand: CstNode[]
  soundCommand: CstNode[]
  teleportCommand: CstNode[]
  textureCommand: CstNode[]
  urlCommand: CstNode[]
  visibleCommand: CstNode[]
  warpCommand: CstNode[]
}

export interface TriggerCtx {
  Create: IToken[]
  Activate: IToken[]
  Bump: IToken[]
  Adone: IToken[]
}

export interface ActionCtx {
  trigger: CstNode[]
  command: CstNode[]
}

export interface ActionsCtx {
  action: CstNode[]
}
