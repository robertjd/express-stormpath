/**
 * problems to solve:
 *
 * - how to know which properties need to go back onto account.customData when transforming an okta user into a stormpath account
 * - how to know which import strategy has been used, so that we use the same strategy when creating new accounts
 * - how to handle values that have different types for the same key path
 */


let customData = {
    "hello": "world",
    "address": {
        "street": "1st ave",
        "zip": 1234
    },
    "freeForm": {

    },
    "nested": {
        "again": {
            "yolo": "swag"
        }
    },
    "memos": ["one","two","three"]
}

// default option

let profile = {
    hello: 'world',
    address_street: '1st ave',
    address_zip: 1234,
    memos: ['one','two','three'],
    nested_again_yolo: 'swag'
}
