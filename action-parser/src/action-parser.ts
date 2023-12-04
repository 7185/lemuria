import {createToken, Lexer, CstParser} from 'chevrotain'
import type {CstNode, ITokenConfig, TokenType} from 'chevrotain'

// Tokens
export const allTokens: TokenType[] = []

const addToken = (tokenConfig: ITokenConfig) => {
  const token = createToken(tokenConfig)
  allTokens.unshift(token)
  return token
}

// The order of TokenTypes in the lexer definition is important
// They are in fact sorted in the opposite order to their declaration

// Special category token, created to handle keywords inside identifiers
const Resource = addToken({
  name: 'Resource',
  pattern: Lexer.NA
})

// The Identifier isn't directly used (just like Whitespace)
addToken({
  name: 'Identifier',
  // eslint-disable-next-line no-control-regex
  pattern: /[\u0000-\u0019\u0021-\u002B\u002D-\u003A\u003C-\uFFFF]+/,
  categories: [Resource]
})
const Enabled = addToken({
  name: 'Enabled',
  pattern: /\b(?:on|true|yes)\b/i,
  categories: [Resource]
})
const Disabled = addToken({
  name: 'Disabled',
  pattern: /\b(?:off|false|no)\b/i,
  categories: [Resource]
})
const Reset = addToken({
  name: 'Reset',
  pattern: /\b(?:no)?reset\b/i,
  categories: [Resource]
})
const Loop = addToken({
  name: 'Loop',
  pattern: /\b(?:no)?loop\b/i,
  categories: [Resource]
})
const Sync = addToken({
  name: 'Sync',
  pattern: /\b(?:no)?sync\b/i,
  categories: [Resource]
})
const Sign = addToken({
  name: 'Sign',
  pattern: /\bsign\b/i,
  categories: [Resource]
})
const Color = addToken({
  name: 'Color',
  pattern: /\bcolor\b/i,
  categories: [Resource]
})
const Bcolor = addToken({
  name: 'Bcolor',
  pattern: /\bbcolor\b/i,
  categories: [Resource]
})
const Name = addToken({
  name: 'Name',
  pattern: /\bname\b/i,
  categories: [Resource]
})
const Mask = addToken({
  name: 'Mask',
  pattern: /\bmask\b/i,
  categories: [Resource]
})
const Light = addToken({
  name: 'Light',
  pattern: /\blight\b/i,
  categories: [Resource]
})
const Corona = addToken({
  name: 'Corona',
  pattern: /\bcorona\b/i,
  categories: [Resource]
})
const Noise = addToken({
  name: 'Noise',
  pattern: /\bnoise\b/i,
  categories: [Resource]
})
const Sound = addToken({
  name: 'Sound',
  pattern: /\bsound\b/i,
  categories: [Resource]
})
const Radius = addToken({
  name: 'Radius',
  pattern: /\bradius\b/i,
  categories: [Resource]
})
const Size = addToken({
  name: 'Size',
  pattern: /\bsize\b/i,
  categories: [Resource]
})
const Tag = addToken({name: 'Tag', pattern: /\btag\b/i, categories: [Resource]})
const Url = addToken({name: 'Url', pattern: /\burl\b/i, categories: [Resource]})
const Time = addToken({
  name: 'Time',
  pattern: /\btime\b/i,
  categories: [Resource]
})
const Wait = addToken({
  name: 'Wait',
  pattern: /\bwait\b/i,
  categories: [Resource]
})
const Update = addToken({
  name: 'Update',
  pattern: /\bupdate\b/i,
  categories: [Resource]
})
const Type = addToken({
  name: 'Type',
  pattern: /\btype\b/i,
  categories: [Resource]
})
const Brightness = addToken({
  name: 'Brightness',
  pattern: /\bbrightness\b/i,
  categories: [Resource]
})
const Fx = addToken({name: 'Fx', pattern: /\bfx\b/i, categories: [Resource]})
const Angle = addToken({
  name: 'Angle',
  pattern: /\bangle\b/i,
  categories: [Resource]
})
const Pitch = addToken({
  name: 'Pitch',
  pattern: /\bpitch\b/i,
  categories: [Resource]
})
const Examine = addToken({
  name: 'Examine',
  pattern: /\bexamine\b/i,
  categories: [Resource]
})
const Media = addToken({
  name: 'Media',
  pattern: /\bmedia\b/i,
  categories: [Resource]
})
const Move = addToken({
  name: 'Move',
  pattern: /\bmove\b/i,
  categories: [Resource]
})
const Picture = addToken({
  name: 'Picture',
  pattern: /\bpicture\b/i,
  categories: [Resource]
})
const Rotate = addToken({
  name: 'Rotate',
  pattern: /\brotate\b/i,
  categories: [Resource]
})
const Solid = addToken({
  name: 'Solid',
  pattern: /\bsolid\b/i,
  categories: [Resource]
})
const Visible = addToken({
  name: 'Visible',
  pattern: /\bvisible\b/i,
  categories: [Resource]
})
const Teleport = addToken({
  name: 'Teleport',
  pattern: /\bteleport\b/i,
  categories: [Resource]
})
const Warp = addToken({
  name: 'Warp',
  pattern: /\bwarp\b/i,
  categories: [Resource]
})
const Texture = addToken({
  name: 'Texture',
  pattern: /\btexture\b/i,
  categories: [Resource]
})
const Adone = addToken({
  name: 'Adone',
  pattern: /\badone\b/i,
  categories: [Resource]
})
const Bump = addToken({
  name: 'Bump',
  pattern: /\bbump\b/i,
  categories: [Resource]
})
const Activate = addToken({
  name: 'Activate',
  pattern: /\bactivate\b/i,
  categories: [Resource]
})
const Create = addToken({
  name: 'Create',
  pattern: /\bcreate\b/i,
  categories: [Resource]
})
const Equals = addToken({
  name: 'Equals',
  pattern: /\b=\b/,
  categories: [Resource]
})
const Comma = addToken({name: 'Comma', pattern: /,/})
const Semicolon = addToken({name: 'Semicolon', pattern: /;/})
addToken({
  name: 'Whitespace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

export class ActionParser extends CstParser {
  constructor() {
    super(allTokens)
    this.performSelfAnalysis()
  }

  public colorCommand = this.RULE('colorCommand', () => {
    this.CONSUME(Color)
    this.CONSUME(Resource)
    this.OPTION(() => this.SUBRULE(this.nameParameter))
  })

  public examineCommand = this.RULE('examineCommand', () => {
    this.CONSUME(Examine)
  })

  public signCommand = this.RULE('signCommand', () => {
    this.CONSUME(Sign)
    this.MANY({
      GATE: () =>
        ['Name', 'Color', 'Bcolor'].indexOf(this.LA(1).tokenType.name) === -1,
      DEF: () => this.CONSUME(Resource)
    })
    this.OPTION1(() => this.SUBRULE(this.signArgs))
  })

  public mediaCommand = this.RULE('mediaCommand', () => {
    this.CONSUME(Media)
    this.CONSUME(Resource)
    this.OPTION(() => this.SUBRULE(this.mediaArgs))
  })

  public moveCommand = this.RULE('moveCommand', () => {
    this.CONSUME(Move)
    this.AT_LEAST_ONE({
      GATE: () => /[+-]?(\d*[.])?\d+/.test(this.LA(1).image),
      DEF: () => this.CONSUME(Resource)
    })
    this.OPTION(() => this.SUBRULE(this.moveArgs))
  })

  public rotateCommand = this.RULE('rotateCommand', () => {
    this.CONSUME(Rotate)
    this.AT_LEAST_ONE({
      GATE: () => /[+-]?(\d*[.])?\d+/.test(this.LA(1).image),
      DEF: () => this.CONSUME(Resource)
    })
    this.OPTION(() => this.SUBRULE(this.moveArgs))
  })

  public nameCommand = this.RULE('nameCommand', () => {
    this.CONSUME(Name)
    this.CONSUME(Resource)
  })

  public lightCommand = this.RULE('lightCommand', () => {
    this.CONSUME(Light)
    this.OPTION(() => this.SUBRULE(this.lightArgs))
  })

  public coronaCommand = this.RULE('coronaCommand', () => {
    this.CONSUME(Corona)
    this.CONSUME(Resource)
    this.OPTION(() => this.SUBRULE(this.coronaArgs))
  })

  public noiseCommand = this.RULE('noiseCommand', () => {
    this.CONSUME(Noise)
    this.CONSUME(Resource)
  })

  public soundCommand = this.RULE('soundCommand', () => {
    this.CONSUME(Sound)
    this.CONSUME(Resource)
  })

  public pictureCommand = this.RULE('pictureCommand', () => {
    this.CONSUME(Picture)
    this.CONSUME(Resource)
    this.OPTION(() => this.SUBRULE(this.pictureArgs))
  })

  public solidCommand = this.RULE('solidCommand', () => {
    this.CONSUME(Solid)
    this.OPTION({
      GATE: () =>
        ['Enabled', 'Disabled'].indexOf(this.LA(2).tokenType.name) > -1,
      DEF: () => this.CONSUME(Resource)
    })
    this.SUBRULE(this.boolean)
  })

  public visibleCommand = this.RULE('visibleCommand', () => {
    this.CONSUME(Visible)
    this.OPTION({
      GATE: () =>
        ['Enabled', 'Disabled'].indexOf(this.LA(2).tokenType.name) > -1,
      DEF: () => this.CONSUME(Resource)
    })
    this.SUBRULE(this.boolean)
  })

  public teleportCommand = this.RULE('teleportCommand', () => {
    this.CONSUME(Teleport)
    this.AT_LEAST_ONE(() => {
      this.CONSUME(Resource)
    })
  })

  public urlCommand = this.RULE('urlCommand', () => {
    this.CONSUME(Url)
    this.CONSUME(Resource)
  })

  public warpCommand = this.RULE('warpCommand', () => {
    this.CONSUME(Warp)
    this.AT_LEAST_ONE(() => {
      this.CONSUME(Resource)
    })
  })

  public textureCommand = this.RULE('textureCommand', () => {
    this.CONSUME(Texture)
    this.CONSUME(Resource)
    this.OPTION(() => this.SUBRULE(this.textureArgs))
  })

  public angleParameter = this.RULE('angleParameter', () => {
    this.CONSUME(Angle)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public pitchParameter = this.RULE('pitchParameter', () => {
    this.CONSUME(Pitch)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public fxParameter = this.RULE('fxParameter', () => {
    this.CONSUME(Fx)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public brightnessParameter = this.RULE('brightnessParameter', () => {
    this.CONSUME(Brightness)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public colorParameter = this.RULE('colorParameter', () => {
    this.CONSUME(Color)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public bcolorParameter = this.RULE('bcolorParameter', () => {
    this.CONSUME(Bcolor)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public nameParameter = this.RULE('nameParameter', () => {
    this.CONSUME(Name)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public maskParameter = this.RULE('maskParameter', () => {
    this.CONSUME(Mask)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public radiusParameter = this.RULE('radiusParameter', () => {
    this.CONSUME(Radius)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public sizeParameter = this.RULE('sizeParameter', () => {
    this.CONSUME(Size)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public tagParameter = this.RULE('tagParameter', () => {
    this.CONSUME(Tag)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public timeParameter = this.RULE('timeParameter', () => {
    this.CONSUME(Time)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public typeParameter = this.RULE('typeParameter', () => {
    this.CONSUME(Type)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public updateParameter = this.RULE('updateParameter', () => {
    this.CONSUME(Update)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public waitParameter = this.RULE('waitParameter', () => {
    this.CONSUME(Wait)
    this.CONSUME(Equals)
    this.CONSUME(Resource)
  })

  public coronaArgs = this.RULE('coronaArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.maskParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)},
        {ALT: () => this.SUBRULE(this.sizeParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public mediaArgs = this.RULE('mediaArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.radiusParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public lightArgs = this.RULE('lightArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.angleParameter)},
        {ALT: () => this.SUBRULE(this.brightnessParameter)},
        {ALT: () => this.SUBRULE(this.colorParameter)},
        {ALT: () => this.SUBRULE(this.fxParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)},
        {ALT: () => this.SUBRULE(this.pitchParameter)},
        {ALT: () => this.SUBRULE(this.radiusParameter)},
        {ALT: () => this.SUBRULE(this.timeParameter)},
        {ALT: () => this.SUBRULE(this.typeParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public moveArgs = this.RULE('moveArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.timeParameter)},
        {ALT: () => this.SUBRULE(this.waitParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)},
        {ALT: () => this.CONSUME(Loop)},
        {ALT: () => this.CONSUME(Reset)},
        {ALT: () => this.CONSUME(Sync)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public pictureArgs = this.RULE('pictureArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.nameParameter)},
        {ALT: () => this.SUBRULE(this.updateParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public signArgs = this.RULE('signArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.colorParameter)},
        {ALT: () => this.SUBRULE(this.bcolorParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public textureArgs = this.RULE('textureArgs', () => {
    const args: CstNode[] = []
    this.MANY(() => {
      const arg = this.OR([
        {ALT: () => this.SUBRULE(this.maskParameter)},
        {ALT: () => this.SUBRULE(this.nameParameter)},
        {ALT: () => this.SUBRULE(this.tagParameter)}
      ])
      if (arg) {
        args.push(arg)
      }
    })
    return args
  })

  public boolean = this.RULE('boolean', () => {
    this.OR([
      {ALT: () => this.CONSUME(Enabled)},
      {ALT: () => this.CONSUME(Disabled)}
    ])
  })

  public command = this.RULE('command', () => {
    this.OR([
      {ALT: () => this.SUBRULE(this.colorCommand)},
      {ALT: () => this.SUBRULE(this.coronaCommand)},
      {ALT: () => this.SUBRULE(this.examineCommand)},
      {ALT: () => this.SUBRULE(this.lightCommand)},
      {ALT: () => this.SUBRULE(this.mediaCommand)},
      {ALT: () => this.SUBRULE(this.moveCommand)},
      {ALT: () => this.SUBRULE(this.nameCommand)},
      {ALT: () => this.SUBRULE(this.noiseCommand)},
      {ALT: () => this.SUBRULE(this.pictureCommand)},
      {ALT: () => this.SUBRULE(this.rotateCommand)},
      {ALT: () => this.SUBRULE(this.signCommand)},
      {ALT: () => this.SUBRULE(this.solidCommand)},
      {ALT: () => this.SUBRULE(this.soundCommand)},
      {ALT: () => this.SUBRULE(this.teleportCommand)},
      {ALT: () => this.SUBRULE(this.textureCommand)},
      {ALT: () => this.SUBRULE(this.urlCommand)},
      {ALT: () => this.SUBRULE(this.visibleCommand)},
      {ALT: () => this.SUBRULE(this.warpCommand)}
    ])
  })

  public trigger = this.RULE('trigger', () => {
    this.OR([
      {ALT: () => this.CONSUME(Create)},
      {ALT: () => this.CONSUME(Activate)},
      {ALT: () => this.CONSUME(Bump)},
      {ALT: () => this.CONSUME(Adone)}
    ])
  })

  public action = this.RULE('action', () => {
    const trigger = this.SUBRULE(this.trigger) as unknown
    const firstCommand = this.SUBRULE(this.command)
    const commands = [firstCommand]
    this.MANY(() => {
      this.CONSUME(Comma)
      commands.push(this.SUBRULE1(this.command))
    })
    // Optional trailing commas
    this.OPTION(() => this.MANY1(() => this.CONSUME1(Comma)))
    return {[trigger as string]: commands}
  })

  public actions = this.RULE('actions', () => {
    const firstAction = this.SUBRULE(this.action)
    const actionList = [firstAction]
    this.MANY(() => {
      this.CONSUME(Semicolon)
      const nextAction = this.SUBRULE1(this.action)
      if (nextAction) {
        actionList.push(nextAction)
      }
    })
    // Optional trailing semicolons
    this.OPTION(() => this.MANY1(() => this.CONSUME1(Semicolon)))
    return actionList
  })
}
