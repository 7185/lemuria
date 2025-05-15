import {Action} from '../src/index.ts'

const parser = new Action()

test('undefined string', () => {
  expect(parser.parse(undefined as unknown as string)).toStrictEqual({})
})

test('empty string', () => {
  expect(parser.parse('')).toStrictEqual({})
})

test('invalid string', () => {
  expect(parser.parse('foobar')).toStrictEqual({})
})

test('good string has empty debug information', () => {
  expect(parser.debug('create color green;')).toStrictEqual('OK')
})

test('invalid string has debug information', () => {
  expect(parser.debug('color red')).not.toStrictEqual('OK')
})

// Colors
test('empty create color', () => {
  expect(parser.parse('create color')).toStrictEqual({})
})

test('create color f', () => {
  expect(parser.parse('create color f')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 15}
      }
    ]
  })
})

test('create color ff', () => {
  expect(parser.parse('create color ff')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 255}
      }
    ]
  })
})

test('create color fff', () => {
  expect(parser.parse('create color fff')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 15, b: 255}
      }
    ]
  })
})

test('create long color', () => {
  expect(
    parser.parse('create color foobarbazaaaaaaaaaaaaaaaaaa')
  ).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 15}
      }
    ]
  })
})

test('create hex color with negative values', () => {
  expect(parser.parse('create color 2DFDC1C34')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 220, g: 28, b: 52}
      }
    ]
  })
})

test('create very long hex color', () => {
  expect(parser.parse('create color 63FFFFFFFFFFFFFF9C')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 255, g: 255, b: 255}
      }
    ]
  })
})

test('invalid color results in no action', () => {
  expect(parser.parse('create color poorchoice')).toStrictEqual({})
})

test('no color results in no action', () => {
  expect(parser.parse('create color')).toStrictEqual({})
})

test('create color green', () => {
  expect(parser.parse('create color green')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 255, b: 0}
      }
    ]
  })
})

test('whitespace and semicolons do not matter', () => {
  expect(parser.parse('create   color        abcdef;;;;;;')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 171, g: 205, b: 239}
      }
    ]
  })
})

test('multiple color applies last only', () => {
  expect(
    parser.parse('create color green, color red, color blue')
  ).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 0, b: 255}
      }
    ]
  })
})

test('multiple names applies last only', () => {
  expect(parser.parse('create name foo, name bar, name baz')).toStrictEqual({
    create: [
      {
        commandType: 'name',
        targetName: 'baz'
      }
    ]
  })
})

test('multiple create applies first only', () => {
  expect(parser.parse('create color green; create color red')).toStrictEqual({
    create: [
      {
        commandType: 'color',
        color: {r: 0, g: 255, b: 0}
      }
    ]
  })
})

test('rotate with 1 number is about Y', () => {
  expect(parser.parse('create rotate 1')).toStrictEqual({
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
  expect(parser.parse('bump rotate 1 2 name=no_z')).toStrictEqual({
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
  expect(parser.parse('create rotate 1 2 3')).toStrictEqual({
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
  expect(parser.parse('create rotate -.234 234.903 -12.093')).toStrictEqual({
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
  expect(parser.parse('create move 1')).toStrictEqual({
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
  expect(parser.parse('create move 1 2')).toStrictEqual({
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
  expect(parser.parse('create move 1 2 3')).toStrictEqual({
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
  expect(
    parser.parse(
      'create rotate 0 0 0 reset, move 0 0 2 loop reset time=5 wait=1 nosync'
    )
  ).toStrictEqual({
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
  })
})

test('empty command does not return anything', () => {
  expect(parser.parse('create rotate, activate move')).toStrictEqual({})
})

test('examine command returns properly', () => {
  expect(parser.parse('create examine')).toStrictEqual({
    create: [
      {
        commandType: 'examine'
      }
    ]
  })
})

test('multiple color with different names applies all', () => {
  expect(
    parser.parse('create color green, color red name=foo, color blue name=bar')
  ).toStrictEqual({
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
  })
})

// Booleans
test('create solid off', () => {
  expect(parser.parse('create solid off')).toStrictEqual({
    create: [
      {
        commandType: 'solid',
        value: false
      }
    ]
  })
})

test('create solid false', () => {
  expect(parser.parse('create solid false')).toStrictEqual({
    create: [
      {
        commandType: 'solid',
        value: false
      }
    ]
  })
})

test('create solid <name> no', () => {
  expect(parser.parse('create solid image no')).toStrictEqual({
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
  expect(parser.parse('create visible image on')).toStrictEqual({
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
  expect(parser.parse('create visible true')).toStrictEqual({
    create: [
      {
        commandType: 'visible',
        value: true
      }
    ]
  })
})

test('create visible yes', () => {
  expect(parser.parse('create visible yes')).toStrictEqual({
    create: [
      {
        commandType: 'visible',
        value: true
      }
    ]
  })
})

test('create texture with mask', () => {
  expect(
    parser.parse('create texture fleurs19 mask=fleurs19m name=textured')
  ).toStrictEqual({
    create: [
      {
        commandType: 'texture',
        texture: 'fleurs19',
        mask: 'fleurs19m',
        targetName: 'textured'
      }
    ]
  })
})

test('create texture with mask and tag', () => {
  expect(
    parser.parse('create texture fleurs19 mask=fleurs19m tag=abcd')
  ).toStrictEqual({
    create: [
      {
        commandType: 'texture',
        texture: 'fleurs19',
        mask: 'fleurs19m',
        tag: 'abcd'
      }
    ]
  })
})

test('empty create sign returns properly', () => {
  expect(parser.parse('create sign')).toStrictEqual({
    create: [
      {
        commandType: 'sign'
      }
    ]
  })
})

test('create sign with args', () => {
  expect(
    parser.parse('create sign name=welcome color=yellow bcolor=pink')
  ).toStrictEqual({
    create: [
      {
        color: {b: 0, g: 255, r: 255},
        bcolor: {b: 199, g: 110, r: 255},
        commandType: 'sign',
        targetName: 'welcome'
      }
    ]
  })
})

test('create picture', () => {
  expect(
    parser.parse('create picture http://www.example.com/sample.jpg')
  ).toStrictEqual({
    create: [
      {
        commandType: 'picture',
        resource: 'http://www.example.com/sample.jpg'
      }
    ]
  })
})

test('sign text with quotes', () => {
  expect(parser.parse('create sign "i am the sign text"')).toStrictEqual({
    create: [
      {
        commandType: 'sign',
        text: 'i am the sign text'
      }
    ]
  })
})

test('sign text without quotes', () => {
  expect(parser.parse('create sign i_am_the_sign_text')).toStrictEqual({
    create: [
      {
        commandType: 'sign',
        text: 'i_am_the_sign_text'
      }
    ]
  })
})

test('sign text with unquoted unicode', () => {
  expect(parser.parse('create sign 🙃')).toStrictEqual({
    create: [
      {
        commandType: 'sign',
        text: '🙃'
      }
    ]
  })
})

test('sign text with quoted unicode', () => {
  expect(parser.parse('create sign "こんにちは!"')).toStrictEqual({
    create: [
      {
        commandType: 'sign',
        text: 'こんにちは!'
      }
    ]
  })
})

test('sign text with quoted unicode and other things after', () => {
  expect(
    parser.parse('create sign "こんにちは!"; activate sign 🙃')
  ).toStrictEqual({
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
  })
})

/*
test('sign text with only one quote', () => {
  expect(parser.parse('create sign "; activate something')).toStrictEqual({
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
  expect(
    parser.parse('create sign i am the sign text, light brightness=1')
  ).toStrictEqual({
    create: [
      {
        commandType: 'light',
        brightness: 1
      }
    ]
  })
})

test('complex example', () => {
  expect(
    parser.parse(
      'create sign bcolor=white color=black;activate sign Rickrolled bcolor=white color=black, media http://127.0.0.1/music/spam/rickroll/Never_gonna_give_you_up.mp3 name=Mplayer radius=1000'
    )
  ).toStrictEqual({
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
  })
})

test('picture with update and name', () => {
  expect(
    parser.parse('create picture example.jpg update=500 name=image')
  ).toStrictEqual({
    create: [
      {
        commandType: 'picture',
        resource: 'example.jpg',
        targetName: 'image',
        update: 500
      }
    ]
  })
})

test('activate noise', () => {
  expect(
    parser.parse('activate noise http://www.example.com/tchin.wav')
  ).toStrictEqual({
    activate: [
      {
        commandType: 'noise',
        resource: 'http://www.example.com/tchin.wav'
      }
    ]
  })
})

test('create sound', () => {
  expect(
    parser.parse('create sound http://www.example.com/sound.mid')
  ).toStrictEqual({
    create: [
      {
        commandType: 'sound',
        resource: 'http://www.example.com/sound.mid'
      }
    ]
  })
})

test('activate url', () => {
  expect(
    parser.parse('activate url mailto:webmaster@example.com')
  ).toStrictEqual({
    activate: [
      {
        commandType: 'url',
        resource: 'mailto:webmaster@example.com'
      }
    ]
  })
})

test('create corona with params', () => {
  expect(
    parser.parse('create corona corona20 size=10 mask=corona20m name=light')
  ).toStrictEqual({
    create: [
      {
        commandType: 'corona',
        mask: 'corona20m',
        resource: 'corona20',
        size: 10,
        targetName: 'light'
      }
    ]
  })
})

test('create light', () => {
  expect(
    parser.parse(
      'create light color=orange fx=blink time=2 name=light radius=10 type=spot angle=55 pitch=20'
    )
  ).toStrictEqual({
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
  })
})

test.each(['français', 'a.b.c.', 'Mars123'])(
  'simple world name check (%p)',
  (testWorldName) => {
    expect(parser.parse(`bump teleport ${testWorldName}`)).toStrictEqual({
      bump: [
        {
          commandType: 'teleport',
          worldName: testWorldName
        }
      ]
    })
  }
)

test('world name cannot start with a digit', () => {
  expect(parser.parse('bump teleport 1abcd')).toStrictEqual({})
})

test('teleport within the current world', () => {
  expect(parser.parse('activate teleport 12N 10.2W 180')).toStrictEqual({
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
  expect(parser.parse('activate teleport teleport 1.2S .2E 0a')).toStrictEqual({
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
  })
})

test('teleport coords types mismatch', () => {
  expect(
    parser.parse(
      'bump teleport 2N 3E +90, warp +0 +1 -2a 270; activate teleport 2N 3E +1.0a -90'
    )
  ).toStrictEqual({})
})

test('warp absolute', () => {
  expect(parser.parse('bump warp 2.7S 2.2E -0.8a 270')).toStrictEqual({
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
  expect(parser.parse('bump warp +0 +0 +1a')).toStrictEqual({
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
  expect(parser.parse('activate warp 2S 3W')).toStrictEqual({
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
  expect(parser.parse('bump warp +2')).toStrictEqual({})
})

test('animate and astop followed by astart', () => {
  expect(
    parser.parse(
      'create animate tag=dummy mask me jump 5 9 100 1 2 3 4 5 4 3 2 1, astop; activate astart me off'
    )
  ).toStrictEqual({
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
  })
})

test('animate with astart, astop and adone', () => {
  expect(
    parser.parse(
      'create animate me jump 5 5 200, astop; activate astart; adone noise oeo.wav'
    )
  ).toStrictEqual({
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
  })
})

test('animate not enough params', () => {
  expect(parser.parse('create animate nomask me jump 1 1')).toStrictEqual({})
})

test('animate param of wrong type', () => {
  expect(
    parser.parse('create animate nomask me jump 1 1 0 wrong')
  ).toStrictEqual({})
})

test('astart and astop on remote props', () => {
  expect(parser.parse('activate astart testa yes, astop testb')).toStrictEqual({
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
  })
})
