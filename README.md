# gmlewis/json-to-moonbit

Translates JSON into a MoonBit struct definition. [Check it out!](http://gmlewis.github.io/json-to-moonbit)

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
moon 0.1.20240819 (284058b 2024-08-19) ~/.moon/bin/moon
moonc v0.1.20240820+85e9a0dc8 ~/.moon/bin/moonc
moonrun 0.1.20240820 (ecf5abc 2024-08-20) ~/.moon/bin/moonrun
```


## Credits

JSON-to-Go is brought to you by Matt Holt ([mholt6](https://twitter.com/mholt6)).

JSON-to-MoonBit is brought to you by Glenn Lewis.
