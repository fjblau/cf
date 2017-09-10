# swagger-response

The [npm swagger package](https://www.npmjs.com/package/swagger) is an awesome tool for turning your swagger definition files into a working API that will validates responses when they are sent. One thing it does not do is help you to build the response before sending.

This package provides a tool that makes it easy to build valid swagger responses that match your swagger definitions.

# Table of Contents

* [Installation](#installation)
* [Examples](#examples)
* [API](#api)
* [Validation](#validation)
* [Debugging](#debugging)
* [Caveats](#caveats)
* [Example Swagger Definition File](#example-swagger-definition-file)

## Installation

```sh
$ npm install swagger-response
```

## Examples

### Basic Example

The following example is trivial, but it does show that the swagger response object is built from the beginning to match the requirements of the swagger response definition.

Using the [Example Swagger Definition File](#example-swagger-definition-file):

**pets.js**

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    const response = Response(req, 200);
    res.json(response);
};
```

Sends a valid response:

```js
[]
```

### Setting Values Example

Using the [Example Swagger Definition File](#example-swagger-definition-file):

**pets.js**

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.push({ id: 1, name: 'Mittens' });
    response[0].species = 'Cat';
    res.json(response);
};
```

Sends a valid response:

```json
[
  {
    "id":1,
    "name":"Mittens",
    "species":"Cat",
    "links": {
      "get": {
        "href": "/pets/{petId}",
        "method": "GET"
      },
      "update": {
        "href": "/pets/{petId}",
        "method": "PUT"
      }
    }
  }
]
```

### Property Error Example

Using the [Example Swagger Definition File](#example-swagger-definition-file):

**pets.js**

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.push({ id: 1, name: 'Mittens' });
    response[0].type = 'Cat';       // throws an Error - there is no type property
    res.json(response);             // returns an error message
};
```

The error will output to the console, showing the line number where you did something wrong. This saves time because you don't need hunt around for where the invalid data was set.

### Type Error Example

Using the [Example Swagger Definition File](#example-swagger-definition-file):

**pets.js**

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.push('hello');         // throw an Error - the item must be an object
    response.push({ id: 1, name: 'Mittens' });
    response[0].species = 1234;     // throws an Error - species expects a string
    res.json(response);             // returns an error message
};
```

The error will output to the console, showing the line number where you did something wrong. This saves time because you don't need hunt around for where the invalid data was set.

### HATEOAS Example

If you are using [HATEOAS](https://en.wikipedia.org/wiki/HATEOAS) in your responses (like the examples), there is also tool to help write those responses by performing variable substitution within strings.

Using the [Example Swagger Definition File](#example-swagger-definition-file):

**pets.js**

```js
exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.push({ id: 1, name: 'Mittens', species: 'Cat' });
    Response.injectParameters(true, response[0], { petId: 1 }); // replace {petId} with 1
    res.json(response);
};
```

Sends a valid response where the `{petId}` within string values is replaced with `1`:

```json
[
  {
    "id":1,
    "name":"Mittens",
    "tag":"Cat",
    "links": {
      "get": {
        "href": "/pets/1",
        "method": "GET"
      },
      "update": {
        "href": "/pets/1",
        "method": "PUT"
      }
    }
  }
]
```

# API

### Response ( req, [ responseCode ] )

Get a response object. You can add / edit the properties / items to this object, but if you attempt to assign an invalid value to a property or if you attempt to assign a property that does not exist then an error will be throw immediately. The limitations imposed on this object will be those defined in your swagger document. Default values will be added automatically but can be modified.

**Parameters**

* **req** - The incoming request object provided by the server.
* **responseCode** - The response code to look up in the swagger definition. Defaults to `default`.

**Returns** an object

**Examples**

* [Basic Example](#basic-example)
* [Setting Values Example](#setting-values-example)
* [Property Error Example](#property-error-example)
* [Type Error Example](#type-error-example)
* [HATEOAS Example](#hateoas-example)

### Response.injectParameters ( [ recursive, ] obj, data )

Search an object's properties for values with strings. If a value has a string, perform a variable replacement where the string matches the (#response-injectParameterPattern) regular expression (defaults to {varName}).

**Parameters**

* **recursive** - Whether to recursively search the children of the `obj`. Defaults to `true`.
* **obj** - The object to search.
* **data** - An object map of variable names to replace with string values.

**Returns** an object

**Examples**

* [HATEOAS Example](#hateoas-example)

### Response.injectParameterPattern

A property that defines how to perform string replacements. This property must be set to a function that maps string values to another value. For example, the following function (which just happens to be the default) will replace variable names surrounded by handle bars.

```js
Response.injectParameterPattern = function(value, data) {
    var rx = /{([_$a-z][_$a-z0-9]*)}/ig;
    var match;
    var property;
    while (match = rx.exec(value)) {
        property = match[1];
        if (data.hasOwnProperty(property)) {
            value = value.replace(match[0], data[property]);
        }
    }
    return value;
}
```

For example:

1. Given the string: `This {is} {adj} {is} it not`
2. And the data: `{ is: 'was', adj: 'interesting' }`
3. The result would be `This was interesting was it not`.


For your convenience there are three patterns programmed for you already which you can assign:

**colon**

Replaces `:varName`.

```js
Response.injectParameterPattern = Response.injectorPatterns.colon;
```

**doubleHandlebar**

Replaces `{{varName}}`.

```js
Response.injectParameterPattern = Response.injectorPatterns.doubleHandlebar;
```

**handlebar**

Replaces `{varName}`.

```js
Response.injectParameterPattern = Response.injectorPatterns.handlebar;
```

### Response.manageable ( req, [ responseCode ] )

Determine whether a response can be managed. Only objects and arrays can be managed.

**Parameters**

* **req** - The incoming request object provided by the server.
* **responseCode** - The response code to look up in the swagger definition. Defaults to `default`.

**Returns** a boolean

**Examples**

* [Management Limitations](#management-limitations)

## Validation

As you build the response object validations occur for every object property set and for every item added to an array. The following validations currently happen when setting values:

- type
- maximum
- exclusiveMaximum
- minimum
- exclusiveMinimum
- multipleOf
- maxLength
- minLength
- pattern

Some validations are not run during the response composition because it would make it very difficult to compose the result. These validation will still occur (assuming you've told swagger to do so) when the response is sent:

- format
- maxItems
- minItems
- uniqueItems
- maxProperties
- minProperties
- enum

## Debugging

If you are attempting to evaluate the response object it is best to get it's plain object representation. To get the plain object that is built from the response object, use the `toJSON` function.

```js
exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.push({ id: 1, name: 'Mittens', species: 'Cat' });
    console.log(response.toJSON());
    res.json(response);
};
```

## Caveats

### Swagger Versions

Currently only version 2.x is supported.

### Management Limitations

The swagger response object can only manage mutable variables, otherwise you'll need to make assignments and that would overwrite the swagger response object. To prevent this, if you attempt to use a swagger response object for a primitive response then an error will be thrown.

To determine with code if the response can be managed, you can do the following:

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    if (Response.manageable(req, 200)) {
        // the response can be managed
    }
};
```

### Arrays

The swagger response object does not use the Array object, instead it uses an object that mimics the Array while also providing validation for each item added to the array. The only case where this may be a problem is when you are trying to set a value to an index that is beyond the length of the existing array (i.e. array length is 2 and your trying to set the value at index 10).

If you must set a value beyond the length of the array, use the `set` function.

**Example**

```js
const Response = require('swagger-response');

exports.listPets = function(req, res) {
    const response = Response(req, 200);
    response.set(1, { id: 2, name: 'Jack' });   // array length is now 2
    response[0] = { id: 1, name: 'Mittens' };   // valid because the array length > 0
    res.json(response); // returns [{"id":1,"name":"Mittens"},{"id":2,"name":"Jack"}]
};
```

## Example Swagger Definition File

All examples on this page use this same swagger definition file:

```yaml
swagger: "2.0"
info:
  version: "0.0.1"
  title: Pets
paths:
  /pets:
    x-swagger-router-controller: pets
    get:
      description: List all pets
      operationId: listPets
      responses:
        200:
          description: An paged array of pets
          schema:
            $ref: "#/definitions/Pets"
  /pets/{petId}:
    x-swagger-router-controller: pets
    get:
      description: Get a single pet.
      operationId: getPet
      parameters:
        - name: petId
          in: path
          description: The unique pet ID.
          required: true
          type: number
      responses:
        200:
          description: A single pet.
          schema:
            $ref: "#/definitions/Pet"
    put:
      description: Update a pet.
      operationId: updatePet
      parameters:
        - name: petId
          in: path
          description: The unique pet ID.
          required: true
          type: number
      responses:
        200:
          description: A single pet.
          schema:
            $ref: "#/definitions/Pet"
definitions:
  hateoas:
    properties:
      get:
        properties:
          href:
            type: string
            default: "/pets/{petId}"
          method:
            type: string
            default: GET
      update:
        properties:
          href:
            type: string
            default: "/pets/{petId}"
          method:
            type: string
            default: PUT
  Pet:
    properties:
      links:
        $ref: "#/definitions/hateoas"
      id:
        type: number
      name:
        type: string
      species:
        type: string
  Pets:
    type: array
    items:
      $ref: "#/definitions/Pet"
```



