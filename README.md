# gmlewis/json-to-moonbit

Translates JSON into MoonBit code. [Check it out!](http://gmlewis.github.io/json-to-moonbit)

This is based on Matt Holt's [json-to-go](http://mholt.github.io/json-to-go).

Things to note:

- The script sometimes has to make some assumptions, so give the output a once-over.
- In an array of objects, it is assumed that the first object is representative of the rest of them.
- The output is indented, but not formatted. Use `moon fmt`!

Contributions are welcome! Open a pull request to fix a bug, or open an issue to discuss a new feature or change.

## Usage

- Read JSON file:

  ```sh
  node json-to-moonbit.js sample.json
  ```

- Read JSON file from stdin:

  ```sh
  node json-to-moonbit.js < sample.json
  cat sample.json | node json-to-moonbit.js
  ```

## Status

The code has been updated to support compiler:

```bash
$ moon version --all
moon 0.1.20240823 (f608aa3 2024-08-23) ~/.moon/bin/moon
moonc v0.1.20240823+c622a5ab0 ~/.moon/bin/moonc
moonrun 0.1.20240822 (efda7a5 2024-08-22) ~/.moon/bin/moonrun
```


## Credits

JSON-to-Go is brought to you by Matt Holt ([mholt6](https://twitter.com/mholt6)).

JSON-to-MoonBit is brought to you by Glenn Lewis.

diff is Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>
All rights reserved.
and is used for testing. It is from: https://github.com/kpdecker/jsdiff/
with license: https://github.com/kpdecker/jsdiff/blob/master/LICENSE
