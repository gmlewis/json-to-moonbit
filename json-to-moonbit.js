// -*- compile-command: "bun json-to-moonbit.test.js"; -*-

/*
  JSON-to-MoonBit by Glenn Lewis
  https://github.com/gmlewis/json-to-moonbit
  A simple utility to translate JSON into a MoonBit struct definition.

  which is based upon:

  JSON-to-Go
  by Matt Holt

  https://github.com/mholt/json-to-go

  A simple utility to translate JSON into a Go type definition.
*/

// https://github.com/golang/lint/blob/5614ed5bae6fb75893070bdc0996a68765fdd275/lint.go#L771-L810
const commonInitialisms = [
  "ACL", "API", "ASCII", "CPU", "CSS", "DNS", "EOF", "GUID", "HTML", "HTTP",
  "HTTPS", "ID", "IP", "JSON", "LHS", "QPS", "RAM", "RHS", "RPC", "SLA",
  "SMTP", "SQL", "SSH", "TCP", "TLS", "TTL", "UDP", "UI", "UID", "UUID",
  "URI", "URL", "UTF8", "UTF16", "VM", "XML", "XMPP", "XSRF", "XSS"
]
const reservedWords = ["type", "in", "for", "struct"]
const eachExn = `\n\nfn each_exn[T](arr : Array[T], func : (T) -> Unit!@json.JsonDecodeError) -> Unit!@json.JsonDecodeError {\n  for i = 0; i < arr.length(); i = i + 1 {\n    func!(arr[i])\n  }\n}\n`
const matchSubTypeLookup = {
  'slice': 'Array',
  'Double': 'Number',
  'Int64': 'Number',
  'Int': 'Number',
  // 'Time': 'String',  // TODO: support time
}
const typeToDefaultValue = {
  'String': '""',
  'slice': '[]',
}

function jsonToMoonBit(json, typename, flatten = true, example = false, allOmitempty = false) {
  flatten = true  // always flatten MoonBit
  let data
  let scope
  let moonbit = ''
  let tabs = 0

  const seen = {}
  const stack = []
  let accumulator = ''
  let innerTabs = 0
  let parent = ''
  let globallySeenTypeNames = []
  let previousParents = ''

  let needEachExn = false

  try {
    data = JSON.parse(json.replace(/(:\s*\[?\s*-?\d*)\.0/g, "$1.1")) // hack that forces Doubles to stay as Doubles
    scope = data
  }
  catch (e) {
    return {
      moonbit: '',
      error: e.message
    }
  }

  typename = format(typename || "AutoGenerated")
  append(`pub struct ${typename}`)

  parseScope(scope)

  if (flatten) { moonbit += accumulator }
  if (needEachExn) { moonbit += eachExn }

  // add final newline for POSIX 3.206
  if (!moonbit.endsWith(`\n`)) { moonbit += `\n` }

  return { moonbit }


  function parseScope(scope, depth = 0) {
    if (typeof scope === "object" && scope !== null) {
      if (Array.isArray(scope)) {
        let sliceType
        const scopeLength = scope.length

        for (let i = 0; i < scopeLength; i++) {
          const thisType = mbtType(scope[i])
          if (!sliceType)
            sliceType = thisType
          else if (sliceType != thisType) {
            sliceType = mostSpecificPossibleMbtType(thisType, sliceType)
            if (sliceType == "Json")
              break
          }
        }

        const slice = flatten && ['struct', 'slice'].includes(sliceType) && parent
          ? `Array[${parent}]`
          : sliceType && sliceType !== 'struct' ? 'Array[' : 'Array'
        if (depth === 0 && !parent && sliceType === 'struct' && slice === 'Array') {
          // special case for top-level array of structs
          append(` {\n  auto_generated_array : Array[AutoGeneratedArray]\n} derive(Show, Eq)\n\npub fn to_json(self : AutoGenerated) -> Json {\n  self.auto_generated_array.to_json()\n}\n\npub impl @json.FromJson for AutoGenerated with from_json(json, path) {\n  let json = match json {\n    Array(json) => json\n    _ => raise @json.JsonDecodeError((path, "AutoGenerated::from_json: expected array"))\n  }\n  let auto_generated_array: Array[AutoGeneratedArray] = Array::new(capacity = json.length())\n  each_exn!(\n    json,\n    fn(jv) {\n      let el : AutoGeneratedArray = @json.from_json!(jv)\n      auto_generated_array.push(el)\n    }\n  )\n  { auto_generated_array, }\n}\n\npub struct AutoGenerated`)
          needEachExn = true
        }

        if (flatten && depth >= 2)
          appender(slice)
        else
          append(slice)
        if (sliceType == 'struct') {
          const allFields = {}

          // for each field counts how many times appears
          for (let i = 0; i < scopeLength; i++) {
            const keys = Object.keys(scope[i])
            for (let k in keys) {
              let keyname = keys[k]
              if (!(keyname in allFields)) {
                allFields[keyname] = {
                  value: scope[i][keyname],
                  count: 0
                }
              } else {
                const existingValue = allFields[keyname].value
                const currentValue = scope[i][keyname]

                if (!areSameType(existingValue, currentValue)) {
                  if (existingValue !== null) {
                    allFields[keyname].value = null // force type "Json" if types are not identical
                    console.warn(`Warning: key "${keyname}" uses multiple types. Defaulting to type "Json".`)
                  }
                  allFields[keyname].count++
                  continue
                }

                // if variable was first detected as Int (7) and a second time as Double (3.14)
                // then we want to select Double, not Int. Similar for Int64 and Double.
                if (areSameType(currentValue, 1))
                  allFields[keyname].value = findBestValueForNumberType(existingValue, currentValue)

                if (areObjects(existingValue, currentValue)) {
                  const comparisonResult = compareObjectKeys(
                    Object.keys(currentValue),
                    Object.keys(existingValue)
                  )
                  if (!comparisonResult) {
                    keyname = `${keyname}_${uuidv4()}`
                    allFields[keyname] = {
                      value: currentValue,
                      count: 0
                    }
                  }
                }
              }
              allFields[keyname].count++
            }
          }

          // create a common struct with all fields found in the current array
          // omitempty dict indicates if a field is optional
          const keys = Object.keys(allFields), struct = {}, omitempty = {}
          for (let k in keys) {
            const keyname = keys[k], elem = allFields[keyname]

            struct[keyname] = elem.value
            omitempty[keyname] = elem.count != scopeLength
          }
          parseStruct(depth + 1, innerTabs, struct, omitempty, previousParents, slice) // finally parse the struct !!
        }
        else if (sliceType == 'slice') {
          parseScope(scope[0], depth)
        } else {
          if (flatten && depth >= 2) {
            appender(sliceType || 'Json')
          } else {
            append(sliceType || 'Json')
          }
        }
        if (slice === 'Array[') {
          if (flatten && depth >= 2)
            appender(']')
          else
            append(']')
        }
      } else {
        if (flatten) {
          if (depth >= 2) {
            appender(parent)
          } else {
            append(parent)
          }
        }
        parseStruct(depth + 1, innerTabs, scope, false, previousParents, '')
      }
    } else {
      if (flatten && depth >= 2) {
        appender(mbtType(scope))
      } else {
        append(mbtType(scope))
      }
    }
  }

  // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
  // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
  // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

  function parseStruct(depth, innerTabs, scope, omitempty, oldParents, slice) {
    if (flatten) {
      stack.push(
        depth >= 2
          ? '\n'
          : ''
      )
    }

    const seenTypeNames = []
    const allBuilders = {
      structNewConstructor: ['\n\npub fn '],
      toJsonFn: ['\n\npub fn to_json(self : '],
      fromJsonFn: [`\n\npub impl @json.FromJson for `],
      fromJsonMatchPreludes: [],
      fromJsonMatchConversions: [],
      fromJsonMatchPostludes: [],
      fromJsonMatchArrayHelpers: [],
    }
    let allJsonFieldNamesIdentical = true

    if (flatten && depth >= 2) {
      const parentType = `pub struct ${parent}`
      const scopeKeys = formatScopeKeys(Object.keys(scope))
      const parentName = parent || 'AutoGenerated'
      allBuilders.structNewConstructor.push(`${parentName}::new() -> ${parentName} {\n  {`)
      allBuilders.toJsonFn.push(`${parentName}) -> Json {\n  let json : Map[String, Json] = {}`)
      allBuilders.fromJsonFn.push(`${parentName} with from_json(json, path) {\n  let json = match json.as_object() {\n    Some(json) => json\n    _ =>\n      raise @json.JsonDecodeError(\n        (path, "${parentName}::from_json: expected object"),\n      )\n  }`)

      // this can only handle two duplicate items
      // future improvement will handle the case where there could
      // three or more duplicate keys with different values
      if (parent in seen && compareObjectKeys(scopeKeys, seen[parent])) {
        stack.pop()
        return
      }
      seen[parent] = scopeKeys

      appender(`\n${parentType} {\n`)
      ++innerTabs
      const keys = Object.keys(scope)
      previousParents = parent
      for (let i in keys) {
        const keyname = getOriginalName(keys[i])
        indenter(innerTabs)
        let typename
        let safeToUseKeyname = false
        // structs will be defined on the top level of the moonbit file, so they need to be globally unique
        if (typeof scope[keys[i]] === "object" && scope[keys[i]] !== null) {
          [typename, safeToUseKeyname] = uniqueTypeName(format(keyname), globallySeenTypeNames, previousParents)
          globallySeenTypeNames.push(typename)
        } else {
          [typename, safeToUseKeyname] = uniqueTypeName(format(keyname), seenTypeNames)
          seenTypeNames.push(typename)
        }

        const snakeCaseVarname = snakeCase(typename, safeToUseKeyname ? keyname : '')
        if (!isToJsonFieldNameIdentical(snakeCaseVarname, keyname)) { allJsonFieldNamesIdentical = false }
        appender(snakeCaseVarname + ' : ')  // ':' added here for fields in flattened a struct
        parent = typename
        parseScope(scope[keys[i]], depth)
        const isOption = allOmitempty || (omitempty && omitempty[keys[i]] === true)
        if (isOption) {
          appender('?')
        }
        // appender(' // `json:"' + keyname)
        // if (allOmitempty || (omitempty && omitempty[keys[i]] === true)) {
        //   appender(',omitempty')
        // }
        // if (example && scope[keys[i]] !== '' && typeof scope[keys[i]] !== "object") {
        //   appender('" example:"' + scope[keys[i]])
        // }
        // appender('"`\n')
        appender('\n')
        updateAllBuilders(scope, snakeCaseVarname, keyname, typename, parentName, allBuilders, isOption)

        // structNewConstructor.push(`\n    ${snakeCaseVarname}: ${isOption ? 'None' : mbtValueType},`)
        // if (isOption) {
        //   toJsonFn.push(`\n  match self.${snakeCaseVarname} {\n    Some(${snakeCaseVarname}) => json["${snakeCaseVarname}"] = ${snakeCaseVarname}.to_json()\n    _ => ()\n  }`)
        //   fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${mbtValueType}? = match json.get("${snakeCaseVarname}") {\n    Some(${matchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname})\n    _ => None\n  }`)
        // } else {
        //   toJsonFn.push(`\n    "${keyname}": self.${snakeCaseVarname}.to_json()`)
        //   fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${mbtValueType} = ${snakeCaseVarname}`)
        // }
        // fromJsonMatchPreludes.push(`\n      "${keyname}": ${matchType},`)
      }
      indenter(--innerTabs)
      if (allJsonFieldNamesIdentical && !allOmitempty) {
        appender("} derive(Show, Eq, ToJson)")
        allBuilders.structNewConstructor.push('\n  }\n}')
        appender(allBuilders.structNewConstructor.join(''))
      } else {
        appender("} derive(Show, Eq)")
        allBuilders.structNewConstructor.push('\n  }\n}')
        appender(allBuilders.structNewConstructor.join(''))
        appender(allBuilders.toJsonFn.join(''))
        appender('\n  json.to_json()\n}')
      }
      appender(allBuilders.fromJsonFn.join(''))
      // appender(allBuilders.fromJsonMatchPreludes.join(''))
      // appender('\n    } => {')
      // appender(allBuilders.fromJsonMatchConversions.join(''))
      appender('\n  {')
      appender(allBuilders.fromJsonMatchPostludes.join(''))
      appender('\n  }')
      appender('\n}')
      // appender(`\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json: expected object"))\n  }\n}`)
      appender(allBuilders.fromJsonMatchArrayHelpers.join(''))
      if (allBuilders.fromJsonMatchArrayHelpers.length > 0) { needEachExn = true }
      previousParents = oldParents
    } else {
      const parentName = parent || slice === 'Array' ? 'AutoGeneratedArray' : 'AutoGenerated'
      allBuilders.structNewConstructor.push(`${parentName}::new() -> ${parentName} {\n  {`)
      allBuilders.toJsonFn.push(`${parentName}) -> Json {\n  let json : Map[String, Json] = {}`)
      allBuilders.fromJsonFn.push(`${parentName} with from_json(json, path) {\n  let json = match json.as_object() {\n    Some(json) => json\n    _ =>\n      raise @json.JsonDecodeError(\n        (path, "${parentName}::from_json: expected object"),\n      )\n  }`)

      append(" {\n")
      ++tabs
      const keys = Object.keys(scope)
      previousParents = parent
      for (let i in keys) {
        const keyname = getOriginalName(keys[i])
        indent(tabs)
        let typename
        let safeToUseKeyname = false
        // structs will be defined on the top level of the moonbit file, so they need to be globally unique
        if (typeof scope[keys[i]] === "object" && scope[keys[i]] !== null) {
          [typename, safeToUseKeyname] = uniqueTypeName(format(keyname), globallySeenTypeNames, previousParents)
          globallySeenTypeNames.push(typename)
        } else {
          [typename, safeToUseKeyname] = uniqueTypeName(format(keyname), seenTypeNames)
          seenTypeNames.push(typename)
        }

        const snakeCaseVarname = snakeCase(typename, keyname)
        if (!isToJsonFieldNameIdentical(snakeCaseVarname, keyname)) { allJsonFieldNamesIdentical = false }
        append(snakeCaseVarname + ' : ')  // ':' added here for fields in a struct
        parent = typename
        parseScope(scope[keys[i]], depth)
        const isOption = allOmitempty || (omitempty && omitempty[keys[i]] === true)
        if (isOption) {
          append('?')
        }
        // append(' // `json:"' + keyname)
        // if (allOmitempty || (omitempty && omitempty[keys[i]] === true)) {
        //   append(',omitempty')
        // }
        // if (example && scope[keys[i]] !== '' && typeof scope[keys[i]] !== "object") {
        //   append('" example:"' + scope[keys[i]])
        // }
        // append('"`\n')
        append('\n')
        updateAllBuilders(scope, snakeCaseVarname, keyname, typename, parentName, allBuilders, isOption)

        // structNewConstructor.push(`\n    ${snakeCaseVarname}: ${isOption ? 'None' : mbtValueType},`)
        // if (isOption) {
        //   toJsonFn.push(`\n  match self.${snakeCaseVarname} {\n    Some(${snakeCaseVarname}) => json["${snakeCaseVarname}"] = ${snakeCaseVarname}.to_json()\n    _ => ()\n  }`)
        //   fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${mbtValueType}? = match json.get("${snakeCaseVarname}") {\n    Some(${matchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname})\n    _ => None\n  }`)
        // } else {
        //   toJsonFn.push(`\n    "${keyname}": self.${snakeCaseVarname}.to_json(), // TODO: Fix This 2.`)
        //   fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${mbtValueType} = ${snakeCaseVarname} // TODO: Fix this 4.`)
        // }
        // fromJsonMatchPreludes.push(`\n      "${keyname}": ${matchType},`)
      }
      indent(--tabs)
      if (allJsonFieldNamesIdentical && !allOmitempty) {
        append("} derive(Show, Eq, ToJson)")
        allBuilders.structNewConstructor.push('\n  }\n}')
        append(allBuilders.structNewConstructor.join(''))
      } else {
        append("} derive(Show, Eq)")
        allBuilders.structNewConstructor.push('\n  }\n}')
        append(allBuilders.structNewConstructor.join(''))
        append(allBuilders.toJsonFn.join(''))
        append('\n  json.to_json()\n}')
      }
      append(allBuilders.fromJsonFn.join(''))
      // append(allBuilders.fromJsonMatchPreludes.join(''))
      // append('\n    } => {')
      // append(allBuilders.fromJsonMatchConversions.join(''))
      append('\n  {')
      append(allBuilders.fromJsonMatchPostludes.join(''))
      append('\n  }')
      append('\n}')
      // append(`\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json: expected object"))\n  }\n}`)
      append(allBuilders.fromJsonMatchArrayHelpers.join(''))
      if (allBuilders.fromJsonMatchArrayHelpers.length > 0) { needEachExn = true }
      previousParents = oldParents
    }
    if (flatten)
      accumulator += stack.pop()
  }

  function indent(tabs) {
    for (let i = 0; i < tabs; i++)
      moonbit += '  '
  }

  function append(str) {
    moonbit += str
  }

  function indenter(tabs) {
    for (let i = 0; i < tabs; i++)
      stack[stack.length - 1] += '  '
  }

  function appender(str) {
    stack[stack.length - 1] += str
  }

  // Generate a unique name to avoid duplicate struct field names.
  // This function appends a number at the end of the field name.
  // If no modifications were made, then it returns true for the
  // second part of a tuple meaning it is safe to use the original keyname
  // without modification. This helps in handling the common initialisms.
  function uniqueTypeName(name, seen, prefix = null) {
    if (seen.indexOf(name) === -1) {
      return [name, true]
    }

    // check if we can get a unique name by prefixing it
    if (prefix) {
      name = prefix + name
      if (seen.indexOf(name) === -1) {
        return [name, false]
      }
    }

    let i = 0
    while (true) {
      let newName = name + i.toString()
      if (seen.indexOf(newName) === -1) {
        return [newName, false]
      }

      i++
    }
  }

  // Sanitizes and formats a string to make an appropriate identifier in MoonBit
  function format(str) {
    str = formatNumber(str)

    let sanitized = toProperCase(str).replace(/[^a-z0-9]/ig, '')
    if (!sanitized) {
      return "NamingFailed"
    }

    // After sanitizing the remaining characters can start with a number.
    // Run the sanitized string again trough formatNumber to make sure the identifier is Num[0-9] or Zero_... instead of 1.
    return formatNumber(sanitized)
  }

  // Adds a prefix to a number to make an appropriate identifier in MoonBit
  function formatNumber(str) {
    if (!str)
      return ''
    else if (str.match(/^\d+$/))
      str = 'Num' + str
    else if (str.charAt(0).match(/\d/)) {
      const numbers = {
        '0': 'Zero_', '1': 'One_', '2': 'Two_', '3': 'Three_',
        '4': 'Four_', '5': 'Five_', '6': 'Six_', '7': 'Seven_',
        '8': 'Eight_', '9': 'Nine_'
      }
      str = numbers[str.charAt(0)] + str.substr(1)
    }

    return str
  }

  // Determines the type to use in a Json Match expression and appends to all generator builder arrays.
  function updateAllBuilders(scope, snakeCaseVarname, keyname, typename, parentName, allBuilders, isOption) {
    allBuilders.fromJsonMatchPostludes.push(`\n    ${snakeCaseVarname},`)
    const matchType = mbtType(scope)
    // console.log(`mbtMatchType(scope='${JSON.stringify(scope)}', keyname='${keyname}'): matchType='${matchType}', typename='${typename}'`)

    switch (matchType) {
      case 'struct':
        const subType = mbtType(scope[keyname])
        const subMatchType = matchSubTypeLookup[subType] || subType
      allBuilders.structNewConstructor.push(`\n    ${snakeCaseVarname}: ${isOption ? 'None' : typeToDefaultValue[subType]},`)
        if (isOption) {
          allBuilders.toJsonFn.push(`\n  match self.${snakeCaseVarname} {\n    Some(${snakeCaseVarname}) => json["${snakeCaseVarname}"] = ${snakeCaseVarname}.to_json()\n    _ => ()\n  }`)
          // allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => `) // Some(${snakeCaseVarname})\n    _ => None\n  }`)
        } else {
          allBuilders.toJsonFn.push(`\n  json["${keyname}"] = self.${snakeCaseVarname}.to_json()`)
          // allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType} = ${snakeCaseVarname} // TODO: Fix this 3.`)
        }

        switch (subType) {
          case 'Bool':
            allBuilders.fromJsonMatchConversions.push(`\n      let ${snakeCaseVarname} = ${snakeCaseVarname}.as_bool().or_error!(@json.JsonDecodeError((path, "unable to parse bool")))`)
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(True) => Some(true)\n    Some(False) => Some(false)\n    Some(Null) | None => None\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json:${snakeCaseVarname} expected Bool or Null"))\n  }`)
            } else {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => ${snakeCaseVarname}.as_bool() // TODO-BOOL`)
            }
            break
          case 'Int64':
            allBuilders.fromJsonMatchConversions.push(`\n      let ${snakeCaseVarname} = ${snakeCaseVarname}.to_int64()`)
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}.to_int64())\n    Some(Null) | None => None\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json:${snakeCaseVarname} expected Int64 or Null"))\n  }`)
            } else {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}.to_int64()) // TODO-INT64`)
            }
            break
          case 'Int':
            allBuilders.fromJsonMatchConversions.push(`\n      let ${snakeCaseVarname} = ${snakeCaseVarname}.to_int()`)
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}.to_int())\n    Some(Null) | None => None\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json:${snakeCaseVarname} expected Int or Null"))\n  }`)
            } else {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}.to_int()) // TODO-INT64`)
            }
            break
          case 'slice':
            allBuilders.fromJsonMatchConversions.push(`\n      let ${snakeCaseVarname} : Array[${typename}] = ${snakeCaseVarname}_array_from_json!(${snakeCaseVarname})`)
            allBuilders.fromJsonFn.push(`slice // TODO`)
            allBuilders.fromJsonMatchArrayHelpers.push(`\n\npub fn ${snakeCaseVarname}_array_from_json(json : Array[Json]) -> Array[${typename}]!@json.JsonDecodeError {
  let arr: Array[${typename}] = Array::new(capacity = json.length())
  each_exn!(
    json,
    fn(jv) {
      let el : ${typename} = @json.from_json!(jv)
      arr.push(el)
    }
  )
  arr
}`)
            break
          case 'struct':
            allBuilders.fromJsonMatchConversions.push(`\n      let ${snakeCaseVarname} : ${typename} = @json.from_json!(${snakeCaseVarname})`)
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${typename}? = match json.get("${snakeCaseVarname}") {\n    Some(Object(${snakeCaseVarname})) => Some(@json.from_json!(${snakeCaseVarname}.to_json()))\n    Some(Null) | None => None\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json:${snakeCaseVarname} expected ${typename} or Null"))\n  }`)
            } else {
              allBuilders.fromJsonFn.push(`subMatchType='${subMatchType}' // TODO1`)
            }
            break
          case 'Json':
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = json.get("${snakeCaseVarname}")`)
            } else {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}) // TODO-DEFAULT`)
            }
	    break
          default:
            if (isOption) {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname})\n    Some(Null) | None => None\n    _ => raise @json.JsonDecodeError((path, "${parentName}::from_json:${snakeCaseVarname} expected ${subType} or Null"))\n  }`)
            } else {
              allBuilders.fromJsonFn.push(`\n  let ${snakeCaseVarname} : ${subType}? = match json.get("${snakeCaseVarname}") {\n    Some(${subMatchType}(${snakeCaseVarname})) => Some(${snakeCaseVarname}) // TODO-DEFAULT`)
            }
        }
        // console.log(`mbtMatchType(scope='${JSON.stringify(scope[keyname])}', keyname='${keyname}'): subType='${subType}', subMatchType='${subMatchType}'`)
        if (subMatchType === 'Bool' || subMatchType === 'Json' || subMatchType === 'struct') {
          allBuilders.fromJsonMatchPreludes.push(`\n      "${keyname}": ${snakeCaseVarname},`)
          // allBuilders.fromJsonFn.push(`\n    _ => None\n  }`)
          return
        }
        {
          const result = `${subMatchType}(${snakeCaseVarname})`
          allBuilders.fromJsonMatchPreludes.push(`\n      "${keyname}": ${result},`)
        }
        // allBuilders.fromJsonFn.push(`\n    _ => None\n  }`)
        return
      default:
        {
          const result = `${matchType}(${snakeCaseVarname})`
          allBuilders.fromJsonMatchPreludes.push(`\n      "${keyname}": ${result},`)
        }
        allBuilders.fromJsonFn.push(`subMatchType='${subMatchType}' // TODO3`)
        return
    }
  }

  // Determines the most appropriate MoonBit type for matching
  function mbtType(val) {
    if (val === null)
      return "Json"

    switch (typeof val) {
      case "string":
        if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(\+\d\d:\d\d|Z)$/.test(val))
          return "String" // TODO - support time
        else
          return "String"
      case "number":
        if (val % 1 === 0) {
          if (val > -2147483648 && val < 2147483647)
            return "Int"
          else
            return "Int64"
        }
        else
          return "Double"
      case "boolean":
        return "Bool"
      case "object":
        if (Array.isArray(val))
          return "slice"
        return "struct"
      default:
        return "Json"
    }
  }

  // change the value to expand Ints and Doubles to their larger equivalent
  function findBestValueForNumberType(existingValue, newValue) {
    if (!areSameType(newValue, 1)) {
      console.error(`Error: currentValue ${newValue} is not a number`)
      return null // falls back to mbtType "Json"
    }

    const newMbtType = mbtType(newValue)
    const existingMbtType = mbtType(existingValue)

    if (newMbtType === existingMbtType)
      return existingValue

    // always upgrade Double
    if (newMbtType === "Double")
      return newValue
    if (existingMbtType === "Double")
      return existingValue

    // it's too complex to distinguish Int types and Double, so we force-upgrade to Double
    // if anyone has a better suggestion, PRs are welcome!
    if (newMbtType.includes("Double") && existingMbtType.includes("Int"))
      return Number.MAX_VALUE
    if (newMbtType.includes("Int") && existingMbtType.includes("Double"))
      return Number.MAX_VALUE

    if (newMbtType.includes("Int") && existingMbtType.includes("Int")) {
      const existingValueAbs = Math.abs(existingValue)
      const newValueAbs = Math.abs(newValue)

      // if the sum is overflowing, it's safe to assume numbers are very large. So we force Int64.
      if (!isFinite(existingValueAbs + newValueAbs))
        return Number.MAX_SAFE_INTEGER

      // it's too complex to distinguish Byte, Int, and Int64, so we just use the sum as best-guess
      return existingValueAbs + newValueAbs
    }

    // There should be other cases
    console.error(`Error: something went wrong with findBestValueForNumberType() using the values: '${newValue}' and '${existingValue}'`)
    console.error("       Please report the problem to https://github.com/mholt/json-to-moonbit/issues")
    return null // falls back to mbtType "Json"
  }

  // Given two types, returns the more specific of the two
  function mostSpecificPossibleMbtType(typ1, typ2) {
    if (typ1.substr(0, 6) == "Double"
      && typ2.substr(0, 3) == "Int")
      return typ1
    else if (typ1.substr(0, 3) == "Int"
      && typ2.substr(0, 6) == "Double")
      return typ2
    else
      return "Json"
  }

  // snakeCase converts a StructName to a valid variable_name.
  function snakeCase(str, keyname) {
    // If the keyname is already lowercase and contains only letters and underscore, go ahead and use it.
    if (keyname && keyname.match(/^[a-z_]+$/)) {
      if (reservedWords.indexOf(keyname) >= 0) { return `${keyname}_` }
      return keyname
    }
    if (str.length < 2) { return str.toLowerCase() }
    if (commonInitialisms.indexOf(str) >= 0) {
      const s = str.toLowerCase()
      return reservedWords.indexOf(s) >= 0 ? `${s}_` : s
    }

    str = str.substr(0, 1).toLowerCase() + str.substr(1)
    if (reservedWords.indexOf(str) >= 0) { return `${str}_` }
    return str.replace(/([A-Z]+)/g, function (unused, frag) {
      if (commonInitialisms.indexOf(frag) >= 0) {
        return `_${frag.toLowerCase()}`
      }
      return frag
    }).replace(/([A-Z])([a-z]+)/g, function (unused, sep, frag) {
      if (commonInitialisms.indexOf(`${sep}${frag.toUpperCase()}`) >= 0) {
        return `_${sep.toLowerCase()}${frag.toLowerCase()}`
      }
      return `_${sep.toLowerCase()}${frag}`
    })
  }

  // Proper cases a string according to MoonBit conventions
  function toProperCase(str) {
    // ensure that the SCREAMING_SNAKE_CASE is converted to snake_case
    if (str.match(/^[_A-Z0-9]+$/)) {
      str = str.toLowerCase()
    }

    return str.replace(/(^|[^a-zA-Z])([a-z]+)/g, function (unused, sep, frag) {
      if (commonInitialisms.indexOf(frag.toUpperCase()) >= 0) {
        return sep + frag.toUpperCase()
      }
      return sep + frag[0].toUpperCase() + frag.substr(1).toLowerCase()
    }).replace(/([A-Z])([a-z]+)/g, function (unused, sep, frag) {
      if (commonInitialisms.indexOf(sep + frag.toUpperCase()) >= 0) {
        return (sep + frag).toUpperCase()
      }
      return sep + frag
    })
  }

  function isToJsonFieldNameIdentical(snakeCaseVarname, keyname) {
    // No translation appears to be performed by @json.ToJson.
    // const newName = snakeCaseVarname.replace(/_$/, '').replace(/(_[a-z])/g, function (unused, sep) {
    //   return sep.substr(1).toUpperCase()
    // })
    // if (newName !== keyname) {
    //   console.log(`isToJsonFieldNameIdentical('${snakeCaseVarname}', '${keyname}') => '${newName}' - NOT IDENTICAL!`)
    // }
    return snakeCaseVarname === keyname
  }

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  function getOriginalName(unique) {
    const reLiteralUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const uuidLength = 36

    if (unique.length >= uuidLength) {
      const tail = unique.substr(-uuidLength)
      if (reLiteralUUID.test(tail)) {
        return unique.slice(0, -1 * (uuidLength + 1))
      }
    }
    return unique
  }

  function areObjects(objectA, objectB) {
    const object = "[object Object]"
    return Object.prototype.toString.call(objectA) === object
      && Object.prototype.toString.call(objectB) === object
  }

  function areSameType(objectA, objectB) {
    // prototype.toString required to compare Arrays and Objects
    const typeA = Object.prototype.toString.call(objectA)
    const typeB = Object.prototype.toString.call(objectB)
    return typeA === typeB
  }

  function compareObjectKeys(itemAKeys, itemBKeys) {
    const lengthA = itemAKeys.length
    const lengthB = itemBKeys.length

    // nothing to compare, probably identical
    if (lengthA == 0 && lengthB == 0)
      return true

    // duh
    if (lengthA != lengthB)
      return false

    for (let item of itemAKeys) {
      if (!itemBKeys.includes(item))
        return false
    }
    return true
  }

  function formatScopeKeys(keys) {
    for (let i in keys) {
      keys[i] = format(keys[i])
    }
    return keys
  }
}

if (typeof module != 'undefined') {
  if (!module.parent) {
    let filename = null

    function jsonToMoonBitWithErrorHandling(json) {
      const output = jsonToMoonBit(json)
      if (output.error) {
        console.error(output.error)
        process.exitCode = 1
      }
      process.stdout.write(output.moonbit)
    }

    process.argv.forEach((val, index) => {
      if (index < 2)
        return

      if (!val.startsWith('-')) {
        filename = val
        return
      }

      const argument = val.replace(/-/g, '')
      if (argument === "big") {
        console.warn(`Warning: The argument '${argument}' has been deprecated and has no effect anymore`)
      } else {
        console.error(`Unexpected argument ${val} received`)
        process.exit(1)
      }
    })

    if (filename) {
      const fs = require('fs')
      const json = fs.readFileSync(filename, 'utf8')
      jsonToMoonBitWithErrorHandling(json)
    } else {
      bufs = []
      process.stdin.on('data', function (buf) {
        bufs.push(buf)
      })
      process.stdin.on('end', function () {
        const json = Buffer.concat(bufs).toString('utf8')
        jsonToMoonBitWithErrorHandling(json)
      })
    }
  } else {
    module.exports = jsonToMoonBit
  }
}
