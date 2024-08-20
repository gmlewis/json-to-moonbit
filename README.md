[<img src="https://gmlewis.github.io/json-to-moonbit/resources/images/json-to-moonbit.png" alt="JSON-to-moonbit converts JSON to a Go struct"></a>](https://gmlewis.github.io/json-to-moonbit)

Translates JSON into a MoonBit struct definition. [Check it out!](http://gmlewis.github.io/json-to-moonbit)

This is based on Matt Holt's [json-to-go](http://mholt.github.io/json-to-go).

Things to note:

- The script sometimes has to make some assumptions, so give the output a once-over.
- In an array of objects, it is assumed that the first object is representative of the rest of them.
- The output is indented, but not formatted. Use `moon fmt`!

Contributions are welcome! Open a pull request to fix a bug, or open an issue to discuss a new feature or change.

### Usage

- Read JSON file:

  ```sh
  node json-to-moonbit.js sample.json
  ```

- Read JSON file from stdin:

  ```sh
  node json-to-moonbit.js < sample.json
  cat sample.json | node json-to-moonbit.js
  ```

### Credits

JSON-to-Go is brought to you by Matt Holt ([mholt6](https://twitter.com/mholt6)).

JSON-to-MoonBit is brought to you by Glenn Lewis.
