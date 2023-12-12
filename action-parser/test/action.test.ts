import assert from 'node:assert'
import {test} from 'node:test'

import {Action} from '../src'

const parser = new Action()

test('empty string', () => {
  assert.deepStrictEqual(parser.parse(''), {})
})

test('invalid string', () => {
  assert.deepStrictEqual(parser.parse('foobar'), {})
})

test('good string has empty debug information', () => {
  assert.deepStrictEqual(parser.debug('create color green;'), 'OK')
})

test('invalid string has debug information', () => {
  assert.notDeepStrictEqual(parser.debug('color red'), 'OK')
})

// Colors
test('empty create color', () => {
  assert.deepStrictEqual(parser.parse('create color'), {})
})

test('create color f', () => {
  assert.deepStrictEqual(parser.parse('create color f'), {
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 15}
      }
    ]
  })
})

test('create color ff', () => {
  assert.deepStrictEqual(parser.parse('create color ff'), {
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 255}
      }
    ]
  })
})

test('create color fff', () => {
  assert.deepStrictEqual(parser.parse('create color fff'), {
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 15, b: 255}
      }
    ]
  })
})

test('create long color', () => {
  assert.deepStrictEqual(
    parser.parse('create color foobarbazaaaaaaaaaaaaaaaaaa'),
    {
      create: [
        {
          commandType: 'color',
          color: {r: 0, g: 0, b: 15}
        }
      ]
    }
  )
})

test('create hex color with negative values', () => {
  assert.deepStrictEqual(parser.parse('create color 2DFDC1C34'), {
    create: [
      {
        commandType: 'color',
        color: {r: 220, g: 28, b: 52}
      }
    ]
  })
})

test('create very long hex color', () => {
  assert.deepStrictEqual(parser.parse('create color 63FFFFFFFFFFFFFF9C'), {
    create: [
      {
        commandType: 'color',
        color: {r: 255, g: 255, b: 255}
      }
    ]
  })
})

test('invalid color results in no action', () => {
  assert.deepStrictEqual(parser.parse('create color poorchoice'), {})
})

test('no color results in no action', () => {
  assert.deepStrictEqual(parser.parse('create color'), {})
})

test('create color green', () => {
  assert.deepStrictEqual(parser.parse('create color green'), {
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 255, b: 0}
      }
    ]
  })
})

test('whitespace and semicolons do not matter', () => {
  assert.deepStrictEqual(parser.parse('create   color        abcdef;;;;;;'), {
    create: [
      {
        commandType: 'color',
        color: {r: 171, g: 205, b: 239}
      }
    ]
  })
})

test('multiple color applies last only', () => {
  assert.deepStrictEqual(
    parser.parse('create color green, color red, color blue'),
    {
      create: [
        {
          commandType: 'color',
          color: {r: 0, g: 0, b: 255}
        }
      ]
    }
  )
})

test('multiple names applies last only', () => {
  assert.deepStrictEqual(parser.parse('create name foo, name bar, name baz'), {
    create: [
      {
        commandType: 'name',
        targetName: 'baz'
      }
    ]
  })
})

test('multiple create applies first only', () => {
  assert.deepStrictEqual(parser.parse('create color green; create color red'), {
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 255, b: 0}
      }
    ]
  })
})

test('rotate with 1 number is about Y', () => {
  assert.deepStrictEqual(parser.parse('create rotate 1'), {
    create: [
      {
        commandType: 'rotate',
        speed: {
          x: 0,
          y: 1,
          z: 0
        }
      }
    ]
  })
})

test('rotate with 2 numbers is about X and Y', () => {
  assert.deepStrictEqual(parser.parse('bump rotate 1 2 name=no_z'), {
    bump: [
      {
        commandType: 'rotate',
        speed: {
          x: 1,
          y: 2,
          z: 0
        },
        targetName: 'no_z'
      }
    ]
  })
})

test('rotate with 3 numbers is about X, Y and Z', () => {
  assert.deepStrictEqual(parser.parse('create rotate 1 2 3'), {
    create: [
      {
        commandType: 'rotate',
        speed: {
          x: 1,
          y: 2,
          z: 3
        }
      }
    ]
  })
})

test('rotate can handle funny floats', () => {
  assert.deepStrictEqual(parser.parse('create rotate -.234 234.903 -12.093'), {
    create: [
      {
        commandType: 'rotate',
        speed: {
          x: -0.234,
          y: 234.903,
          z: -12.093
        }
      }
    ]
  })
})

test('move with 1 number is about Y', () => {
  assert.deepStrictEqual(parser.parse('create move 1'), {
    create: [
      {
        commandType: 'move',
        distance: {
          x: 0,
          y: 1,
          z: 0
        }
      }
    ]
  })
})

test('move with 2 numbers is about X and Y', () => {
  assert.deepStrictEqual(parser.parse('create move 1 2'), {
    create: [
      {
        commandType: 'move',
        distance: {
          x: 1,
          y: 2,
          z: 0
        }
      }
    ]
  })
})

test('move with 3 numbers is about X, Y and Z', () => {
  assert.deepStrictEqual(parser.parse('create move 1 2 3'), {
    create: [
      {
        commandType: 'move',
        distance: {
          x: 1,
          y: 2,
          z: 3
        }
      }
    ]
  })
})

test('create rotate & move with reset', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create rotate 0 0 0 reset, move 0 0 2 loop reset time=5 wait=1 nosync'
    ),
    {
      create: [
        {
          commandType: 'rotate',
          speed: {x: 0, y: 0, z: 0},
          reset: true
        },
        {
          commandType: 'move',
          distance: {x: 0, y: 0, z: 2},
          loop: true,
          reset: true,
          sync: false,
          time: 5,
          wait: 1
        }
      ]
    }
  )
})

test('empty command does not return anything', () => {
  assert.deepStrictEqual(parser.parse('create rotate, activate move'), {})
})

test('examine command returns properly', () => {
  assert.deepStrictEqual(parser.parse('create examine'), {
    create: [
      {
        commandType: 'examine'
      }
    ]
  })
})

test('multiple color with different names applies all', () => {
  assert.deepStrictEqual(
    parser.parse('create color green, color red name=foo, color blue name=bar'),
    {
      create: [
        {
          commandType: 'color',
          color: {r: 0, g: 255, b: 0}
        },
        {
          commandType: 'color',
          color: {r: 255, g: 0, b: 0},
          targetName: 'foo'
        },
        {
          commandType: 'color',
          color: {r: 0, g: 0, b: 255},
          targetName: 'bar'
        }
      ]
    }
  )
})

// Booleans
test('create solid off', () => {
  assert.deepStrictEqual(parser.parse('create solid off'), {
    create: [
      {
        commandType: 'solid',
        value: false
      }
    ]
  })
})

test('create solid false', () => {
  assert.deepStrictEqual(parser.parse('create solid false'), {
    create: [
      {
        commandType: 'solid',
        value: false
      }
    ]
  })
})

test('create solid <name> no', () => {
  assert.deepStrictEqual(parser.parse('create solid image no'), {
    create: [
      {
        commandType: 'solid',
        targetName: 'image',
        value: false
      }
    ]
  })
})

test('create visible <name> on', () => {
  assert.deepStrictEqual(parser.parse('create visible image on'), {
    create: [
      {
        commandType: 'visible',
        targetName: 'image',
        value: true
      }
    ]
  })
})

test('create visible true', () => {
  assert.deepStrictEqual(parser.parse('create visible true'), {
    create: [
      {
        commandType: 'visible',
        value: true
      }
    ]
  })
})

test('create visible yes', () => {
  assert.deepStrictEqual(parser.parse('create visible yes'), {
    create: [
      {
        commandType: 'visible',
        value: true
      }
    ]
  })
})

test('create texture with mask', () => {
  assert.deepStrictEqual(
    parser.parse('create texture fleurs19 mask=fleurs19m name=textured'),
    {
      create: [
        {
          commandType: 'texture',
          texture: 'fleurs19',
          mask: 'fleurs19m',
          targetName: 'textured'
        }
      ]
    }
  )
})

test('create texture with mask and tag', () => {
  assert.deepStrictEqual(
    parser.parse('create texture fleurs19 mask=fleurs19m tag=abcd'),
    {
      create: [
        {
          commandType: 'texture',
          texture: 'fleurs19',
          mask: 'fleurs19m',
          tag: 'abcd'
        }
      ]
    }
  )
})

test('empty create sign returns properly', () => {
  assert.deepStrictEqual(parser.parse('create sign'), {
    create: [
      {
        commandType: 'sign'
      }
    ]
  })
})

test('create sign with args', () => {
  assert.deepStrictEqual(
    parser.parse('create sign name=welcome color=yellow bcolor=pink'),
    {
      create: [
        {
          color: {b: 0, g: 255, r: 255},
          bcolor: {b: 199, g: 110, r: 255},
          commandType: 'sign',
          targetName: 'welcome'
        }
      ]
    }
  )
})

test('create picture', () => {
  assert.deepStrictEqual(
    parser.parse('create picture http://www.example.com/sample.jpg'),
    {
      create: [
        {
          commandType: 'picture',
          resource: 'http://www.example.com/sample.jpg'
        }
      ]
    }
  )
})

test('sign text with quotes', () => {
  assert.deepStrictEqual(parser.parse('create sign "i am the sign text"'), {
    create: [
      {
        commandType: 'sign',
        text: 'i am the sign text'
      }
    ]
  })
})

test('sign text without quotes', () => {
  assert.deepStrictEqual(parser.parse('create sign i_am_the_sign_text'), {
    create: [
      {
        commandType: 'sign',
        text: 'i_am_the_sign_text'
      }
    ]
  })
})

test('sign text with unquoted unicode', () => {
  assert.deepStrictEqual(parser.parse('create sign 🙃'), {
    create: [
      {
        commandType: 'sign',
        text: '🙃'
      }
    ]
  })
})

test('sign text with quoted unicode', () => {
  assert.deepStrictEqual(parser.parse('create sign "こんにちは!"'), {
    create: [
      {
        commandType: 'sign',
        text: 'こんにちは!'
      }
    ]
  })
})

test('sign text with quoted unicode and other things after', () => {
  assert.deepStrictEqual(
    parser.parse('create sign "こんにちは!"; activate sign 🙃'),
    {
      create: [
        {
          commandType: 'sign',
          text: 'こんにちは!'
        }
      ],
      activate: [
        {
          commandType: 'sign',
          text: '🙃'
        }
      ]
    }
  )
})

/*
test('sign text with only one quote', () => {
  assert.deepStrictEqual(parser.parse('create sign "; activate something'), {
    create: [
      {
        commandType: 'sign',
        text: '; activate something'
      }
    ]
  })
})
*/

test('invalid sign text without quotes', () => {
  assert.deepStrictEqual(
    parser.parse('create sign i am the sign text, light brightness=1'),
    {
      create: [
        {
          commandType: 'light',
          brightness: 1
        }
      ]
    }
  )
})

test('complex example', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create sign bcolor=white color=black;activate sign Rickrolled bcolor=white color=black, media http://127.0.0.1/music/spam/rickroll/Never_gonna_give_you_up.mp3 name=Mplayer radius=1000'
    ),
    {
      create: [
        {
          commandType: 'sign',
          bcolor: {
            r: 255,
            g: 255,
            b: 255
          },
          color: {
            r: 0,
            g: 0,
            b: 0
          }
        }
      ],
      activate: [
        {
          commandType: 'sign',
          text: 'Rickrolled',
          bcolor: {
            r: 255,
            g: 255,
            b: 255
          },
          color: {
            r: 0,
            g: 0,
            b: 0
          }
        },
        {
          commandType: 'media',
          radius: 1000,
          url: 'http://127.0.0.1/music/spam/rickroll/Never_gonna_give_you_up.mp3',
          targetName: 'Mplayer'
        }
      ]
    }
  )
})

test('picture with update and name', () => {
  assert.deepStrictEqual(
    parser.parse('create picture example.jpg update=500 name=image'),
    {
      create: [
        {
          commandType: 'picture',
          resource: 'example.jpg',
          targetName: 'image',
          update: 500
        }
      ]
    }
  )
})

test('activate noise', () => {
  assert.deepStrictEqual(
    parser.parse('activate noise http://www.example.com/tchin.wav'),
    {
      activate: [
        {
          commandType: 'noise',
          resource: 'http://www.example.com/tchin.wav'
        }
      ]
    }
  )
})

test('create sound', () => {
  assert.deepStrictEqual(
    parser.parse('create sound http://www.example.com/sound.mid'),
    {
      create: [
        {
          commandType: 'sound',
          resource: 'http://www.example.com/sound.mid'
        }
      ]
    }
  )
})

test('activate url', () => {
  assert.deepStrictEqual(
    parser.parse('activate url mailto:webmaster@example.com'),
    {
      activate: [
        {
          commandType: 'url',
          resource: 'mailto:webmaster@example.com'
        }
      ]
    }
  )
})

test('create corona with params', () => {
  assert.deepStrictEqual(
    parser.parse('create corona corona20 size=10 mask=corona20m name=light'),
    {
      create: [
        {
          commandType: 'corona',
          mask: 'corona20m',
          resource: 'corona20',
          size: 10,
          targetName: 'light'
        }
      ]
    }
  )
})

test('create light', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create light color=orange fx=blink time=2 name=light radius=10 type=spot angle=55 pitch=20'
    ),
    {
      create: [
        {
          commandType: 'light',
          angle: 55,
          color: {
            b: 0,
            g: 127,
            r: 255
          },
          fx: 'blink',
          radius: 10,
          pitch: 20,
          time: 2,
          type: 'spot',
          targetName: 'light'
        }
      ]
    }
  )
})
;['français', 'a.b.c.', 'Mars123'].forEach((testWorldName) => {
  test(`simple world name check (${testWorldName})`, () => {
    assert.deepStrictEqual(parser.parse(`bump teleport ${testWorldName}`), {
      bump: [
        {
          commandType: 'teleport',
          worldName: testWorldName
        }
      ]
    })
  })
})

test('world name cannot start with a digit', () => {
  assert.deepStrictEqual(parser.parse('bump teleport 1abcd'), {})
})

test('teleport within the current world', () => {
  assert.deepStrictEqual(parser.parse('activate teleport 12N 10.2W 180'), {
    activate: [
      {
        commandType: 'teleport',
        coordinates: {
          type: 'absolute',
          ns: 12,
          ew: -10.2,
          direction: 180
        }
      }
    ]
  })
})

test('teleport to another world', () => {
  assert.deepStrictEqual(
    parser.parse('activate teleport teleport 1.2S .2E 0a'),
    {
      activate: [
        {
          commandType: 'teleport',
          coordinates: {
            altitude: 0,
            type: 'absolute',
            ns: -1.2,
            ew: 0.2
          },
          worldName: 'teleport'
        }
      ]
    }
  )
})

test('teleport coords types mismatch', () => {
  assert.deepStrictEqual(
    parser.parse(
      'bump teleport 2N 3E +90, warp +0 +1 -2a 270; activate teleport 2N 3E +1.0a -90'
    ),
    {}
  )
})

test('warp absolute', () => {
  assert.deepStrictEqual(parser.parse('bump warp 2.7S 2.2E -0.8a 270'), {
    bump: [
      {
        commandType: 'warp',
        coordinates: {
          altitude: -0.8,
          ew: 2.2,
          ns: -2.7,
          type: 'absolute',
          direction: 270
        }
      }
    ]
  })
})

test('warp relative', () => {
  assert.deepStrictEqual(parser.parse('bump warp +0 +0 +1a'), {
    bump: [
      {
        commandType: 'warp',
        coordinates: {
          altitude: 1,
          type: 'relative',
          x: 0,
          y: 0
        }
      }
    ]
  })
})

test('warp no altitude', () => {
  assert.deepStrictEqual(parser.parse('activate warp 2S 3W'), {
    activate: [
      {
        commandType: 'warp',
        coordinates: {
          type: 'absolute',
          ew: -3,
          ns: -2
        }
      }
    ]
  })
})

test('warp invalid coords', () => {
  assert.deepStrictEqual(parser.parse('bump warp +2'), {})
})

test('animate and astop followed by astart', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create animate tag=dummy mask me jump 5 9 100 1 2 3 4 5 4 3 2 1, astop; activate astart me off'
    ),
    {
      activate: [
        {
          commandType: 'astart',
          targetName: 'me',
          loop: false
        }
      ],
      create: [
        {
          commandType: 'animate',
          tag: 'dummy',
          mask: true,
          targetName: 'me',
          animation: 'jump',
          imageCount: 5,
          frameCount: 9,
          frameDelay: 100,
          frameList: [1, 2, 3, 4, 5, 4, 3, 2, 1]
        },
        {
          commandType: 'astop'
        }
      ]
    }
  )
})

test('animate with astart, astop and adone', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create animate me jump 5 5 200, astop; activate astart; adone noise oeo.wav'
    ),
    {
      create: [
        {
          commandType: 'animate',
          targetName: 'me',
          animation: 'jump',
          mask: false,
          imageCount: 5,
          frameCount: 5,
          frameDelay: 200,
          frameList: []
        },
        {
          commandType: 'astop'
        }
      ],
      activate: [
        {
          commandType: 'astart'
        }
      ],
      adone: [
        {
          commandType: 'noise',
          resource: 'oeo.wav'
        }
      ]
    }
  )
})

test('animate not enough params', () => {
  assert.deepStrictEqual(parser.parse('create animate nomask me jump 1 1'), {})
})

test('animate param of wrong type', () => {
  assert.deepStrictEqual(
    parser.parse('create animate nomask me jump 1 1 0 wrong'),
    {}
  )
})

test('astart and astop on remote props', () => {
  assert.deepStrictEqual(
    parser.parse('activate astart testa yes, astop testb'),
    {
      activate: [
        {
          commandType: 'astart',
          targetName: 'testa',
          loop: true
        },
        {
          commandType: 'astop',
          targetName: 'testb'
        }
      ]
    }
  )
})

test('animate and astop followed by astart', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create animate tag=dummy mask me jump 5 9 100 1 2 3 4 5 4 3 2 1, astop; activate astart me off'
    ),
    {
      activate: [
        {
          commandType: 'astart',
          targetName: 'me',
          loop: false
        }
      ],
      create: [
        {
          commandType: 'animate',
          tag: 'dummy',
          mask: true,
          targetName: 'me',
          animation: 'jump',
          imageCount: 5,
          frameCount: 9,
          frameDelay: 100,
          frameList: [1, 2, 3, 4, 5, 4, 3, 2, 1]
        },
        {
          commandType: 'astop'
        }
      ]
    }
  )
})

test('animate with astart, astop and adone', () => {
  assert.deepStrictEqual(
    parser.parse(
      'create animate me jump 5 5 200, astop; activate astart; adone noise oeo.wav'
    ),
    {
      create: [
        {
          commandType: 'animate',
          targetName: 'me',
          animation: 'jump',
          mask: false,
          imageCount: 5,
          frameCount: 5,
          frameDelay: 200,
          frameList: []
        },
        {
          commandType: 'astop'
        }
      ],
      activate: [
        {
          commandType: 'astart'
        }
      ],
      adone: [
        {
          commandType: 'noise',
          resource: 'oeo.wav'
        }
      ]
    }
  )
})

test('animate not enough params', () => {
  assert.deepStrictEqual(parser.parse('create animate nomask me jump 1 1'), {})
})

test('animate param of wrong type', () => {
  assert.deepStrictEqual(
    parser.parse('create animate nomask me jump 1 1 0 wrong'),
    {}
  )
})

test('astart and astop on remote props', () => {
  assert.deepStrictEqual(
    parser.parse('activate astart testa yes, astop testb'),
    {
      activate: [
        {
          commandType: 'astart',
          targetName: 'testa',
          loop: true
        },
        {
          commandType: 'astop',
          targetName: 'testb'
        }
      ]
    }
  )
})
