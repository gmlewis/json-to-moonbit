test "@test4.AutoGenerated::to_json works as expected" {
  let ag : @test4.AutoGenerated = {
    region: { identifier: { type_: "ISO 3166-1", id: 234 }, autonomous: true },
    municipality: {
      municipality_identifier: { type_: "local", name: "Tórshavn" },
    },
    building: {
      building_identifier: {
        postal: { type_: "local", id: 100 },
        road: { name: "Gríms Kambansgøta", id: 1 },
      },
    },
  }
  let got = ag.to_json().stringify(escape_slash=false)
  let want =
    #|{"region":{"identifier":{"type":"ISO 3166-1","id":234},"autonomous":true},"municipality":{"identifier":{"type":"local","name":"Tórshavn"}},"building":{"identifier":{"postal":{"type":"local","id":100},"road":{"name":"Gríms Kambansgøta","id":1}}}}
  assert_eq!(got, want)
}

test "@json.parse(@test4.AutoGenerated) works as expected" {
  let s =
    #|{"region":{"identifier":{"type":"ISO 3166-1","id":234},"autonomous":true},"municipality":{"identifier":{"type":"local","name":"Tórshavn"}},"building":{"identifier":{"postal":{"type":"local","id":100},"road":{"name":"Gríms Kambansgøta","id":1}}}}
  let jv = @json.parse!(s)
  let got : @test4.AutoGenerated = @json.from_json!(jv)
  let want : @test4.AutoGenerated = {
    region: { identifier: { type_: "ISO 3166-1", id: 234 }, autonomous: true },
    municipality: {
      municipality_identifier: { type_: "local", name: "Tórshavn" },
    },
    building: {
      building_identifier: {
        postal: { type_: "local", id: 100 },
        road: { name: "Gríms Kambansgøta", id: 1 },
      },
    },
  }
  assert_eq!(got, want)
}
