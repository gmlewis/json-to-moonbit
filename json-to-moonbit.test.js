const jsonToMoonBit = require("./json-to-moonbit")

function quote(str) {
  return "'" + str
    .replace(/\t/g, '  ')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "\\'") + "'"
}

function test(includeExampleData) {
  const testCases = [
    {
      input: '{"SourceCode": "exampleDataHere"}',
      expected:
        'pub struct AutoGenerated {\n  source_code : String // `json:"SourceCode"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  source_code : String // `json:"SourceCode" example:"exampleDataHere"`\n}\n',
    },
    {
      input: '{"source_code": "exampleDataHere"}',
      expected:
        'pub struct AutoGenerated {\n  source_code : String // `json:"source_code"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  source_code : String // `json:"source_code" example:"exampleDataHere"`\n}\n',
    },
    {
      input: '{"sourceCode": "exampleDataHere"}',
      expected:
        'pub struct AutoGenerated {\n  source_code : String // `json:"sourceCode"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  source_code : String // `json:"sourceCode" example:"exampleDataHere"`\n}\n',
    },
    {
      input: '{"SOURCE_CODE": ""}',
      expected:
        'pub struct AutoGenerated {\n  source_code : String // `json:"SOURCE_CODE"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  source_code : String // `json:"SOURCE_CODE"`\n}\n',
    },
    {
      input: '{"PublicIP": ""}',
      expected:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"PublicIP"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"PublicIP"`\n}\n',
    },
    {
      input: '{"public_ip": ""}',
      expected:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"public_ip"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"public_ip"`\n}\n',
    },
    {
      input: '{"publicIP": ""}',
      expected:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"publicIP"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"publicIP"`\n}\n',
    },
    {
      input: '{"PUBLIC_IP": ""}',
      expected:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"PUBLIC_IP"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  public_ip : String // `json:"PUBLIC_IP"`\n}\n',
    },
    {
      input: '{"+1": "Fails", "-1": "This should not cause duplicate field name"}',
      expected:
        'pub struct AutoGenerated {\n  num1 : String // `json:"+1"`\n  num10 : String // `json:"-1"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  num1 : String // `json:"+1" example:"Fails"`\n  num10 : String // `json:"-1" example:"This should not cause duplicate field name"`\n}\n',
    },
    {
      input: '{"age": 46}',
      expected:
        'pub struct AutoGenerated {\n  age : Int // `json:"age"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  age : Int // `json:"age" example:"46"`\n}\n',
    },
    {
      input: '{"negativeFloat": -1.00}',
      expected:
        'pub struct AutoGenerated {\n  negative_float : Double // `json:"negativeFloat"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  negative_float : Double // `json:"negativeFloat" example:"-1.1"`\n}\n',
    },
    {
      input: '{"zeroFloat": 0.00}',
      expected:
        'pub struct AutoGenerated {\n  zero_float : Double // `json:"zeroFloat"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  zero_float : Double // `json:"zeroFloat" example:"0.1"`\n}\n',
    },
    {
      input: '{"positiveFloat": 1.00}',
      expected:
        'pub struct AutoGenerated {\n  positive_float : Double // `json:"positiveFloat"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  positive_float : Double // `json:"positiveFloat" example:"1.1"`\n}\n',
    },
    {
      input: '{"negativeFloats": [-1.00, -2.00, -3.00]}',
      expected:
        'pub struct AutoGenerated {\n  negative_floats : Array[Double] // `json:"negativeFloats"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  negative_floats : Array[Double] // `json:"negativeFloats"`\n}\n',
    },
    {
      input: '{"zeroFloats": [0.00, 0.00, 0.00]}',
      expected:
        'pub struct AutoGenerated {\n  zero_floats : Array[Double] // `json:"zeroFloats"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  zero_floats : Array[Double] // `json:"zeroFloats"`\n}\n',
    },
    {
      input: '{"positiveFloats": [1.00, 2.00, 3.00]}',
      expected:
        'pub struct AutoGenerated {\n  positive_floats : Array[Double] // `json:"positiveFloats"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  positive_floats : Array[Double] // `json:"positiveFloats"`\n}\n',
    },
    {
      input: '{"topLevel": { "secondLevel": "exampleDataHere"} }',
      expected:
        'pub struct AutoGenerated {\n  top_level : TopLevel // `json:"topLevel"`\n}\n\npub struct TopLevel {\n  second_level : String // `json:"secondLevel"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  top_level : TopLevel // `json:"topLevel"`\n}\n\npub struct TopLevel {\n  second_level : String // `json:"secondLevel" example:"exampleDataHere"`\n}\n',
    },
    {
      input: '{"people": [{ "name": "Frank"}, {"name": "Dennis"}, {"name": "Dee"}, {"name": "Charley"}, {"name":"Mac"}] }',
      expected:
        'pub struct AutoGenerated {\n  people : Array[People] // `json:"people"`\n}\n\npub struct People {\n  name : String // `json:"name"`\n}\n',
      expectedWithExample:
        'pub struct AutoGenerated {\n  people : Array[People] // `json:"people"`\n}\n\npub struct People {\n  name : String // `json:"name" example:"Frank"`\n}\n',
    },
  ]

  for (const testCase of testCases) {
    const got = jsonToMoonBit(testCase.input, null, null, includeExampleData)
    if (got.error) {
      console.assert(!got.error, `format('${testCase.input}'): ${got.error}`)
      process.exitCode = 16
    } else {
      const exp = includeExampleData ? testCase.expectedWithExample : testCase.expected
      const success = got.moonbit === exp
      console.assert(success,
        `format('${testCase.input}'): \n  got:  ${quote(got.moonbit)}\n  want: ${quote(exp)}`
      )
      if (!success) process.exitCode = 17
    }
  }
  console.log(includeExampleData ? 'done testing samples with data' : 'done testing samples without data')
}

function testFiles() {
  const fs = require('fs')
  const path = require('path')

  const testCases = [
    'array-with-mixed-float-int',
    'array-with-nonmatching-types',
    'double-nested-objects',
    'duplicate-top-level-structs',
    'smarty-streets-api',
    'struct-of-array-of-struct',
  ]

  for (const testCase of testCases) {
    console.log(`\nRunning testCase: '${testCase}'`)
    try {
      const jsonData = fs.readFileSync(path.join('tests', testCase + '.json'), 'utf8')
      const expectedMoonBitData = fs.readFileSync(path.join('tests', testCase + '.mbt'), 'utf8')
      const got = jsonToMoonBit(jsonData)
      if (got.error) {
        console.assert(!got.error, `format('${jsonData}'): ${got.error}`)
        process.exitCode = 18
      } else {
        const success = got.moonbit === expectedMoonBitData
        console.assert(success,
          `format('${jsonData}'): \n  got:  ${quote(got.moonbit)}\n  want: ${quote(expectedMoonBitData)}`
        )
        if (!success) process.exitCode = 19
      }
    } catch (err) {
      console.error(err)
      process.exitCode = 20
    }
  }
  console.log('done testing files')
}

test(false)
test(true)
testFiles()
