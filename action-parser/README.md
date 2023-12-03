# Lemuria - action-parser

This library is a rewrite of [aw-action-parser](https://github.com/Heldroe/aw-action-parser) by David Guerrero.

It parses [ActiveWorlds object action strings](http://wiki.activeworlds.com/index.php?title=Object_scripting) (also known as **object scripting**) into a machine-friendly data model.

This project uses Chevrotain instead of Ohm, mostly for performance reasons.

## Usage

```js
import { Action } from 'action-parser';

const action = new Action();

action.parse('create color blue, sign "hello!"; activate color salmon, rotate -.5 loop nosync');
```

The `parse()` function will then return an object looking like this:

```js
{
  create: [
    {
      commandType: 'color',
      color: { r: 0, g: 0, b: 255 }
    }
  ],
  activate: [
    {
      commandType: 'color',
      color: { r: 111, g: 66, b: 66 }
    },
    {
      commandType: 'rotate',
      speed: { x: 0, y: -0.5, z: 0 },
      loop: true,
      sync: false
    }
  ]
}
```

## Limitations

The parsing is very strict (the whole parsing fails on invalid commands) and there is still some commands missing (`animate`, `astart`, `adone`...). \
Some edge cases are not handled properly for the moment, especially on signs (eg. `create sign "; activate something`).
