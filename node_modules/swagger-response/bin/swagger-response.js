"use strict";
const fs            = require('fs');
const mwMetadata    = require('swagger-tools/middleware/swagger-metadata');
const Promise       = require('bluebird');
const tools         = require('swagger-tools');
const yaml          = require('js-yaml');

const metadata = function(req, swaggerObject) {
    const res = {};
    const middleware = mwMetadata(swaggerObject);
    return new Promise(function(resolve, reject) {
        tools.initializeMiddleware(swaggerObject, function(middleware) {
            middleware.swaggerMetadata(swaggerObject)(req, res, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
    });
};
const readFile = Promise.promisify(fs.readFile, { context: fs });

module.exports = SwaggerResponse;

var swaggerObject = null;

/**
 * Get a managed object that will automatically make sure that you don't set values that you shouldn't.
 * If the response schema is not an object though then this function will throw an error.
 * @param {IncomingMessage, object} req
 * @param {string, number} [responseCode="default"]
 * @returns {object}
 * @throws {Error} in case of unexpected structure.
 * @constructor
 */
function SwaggerResponse(req, responseCode) {

    const responses = getPropertyChainValue(req, 'swagger.operation.responses', '');
    if (arguments.length === 1) responseCode = 'default';
    responseCode = '' + responseCode;

    // get the schema
    const schema = getPropertyChainValue(responses, responseCode + '.schema', '');

    // validate that the type is not primitive
    const type = getPropertyType(schema);
    if (type !== 'object' && type !== 'array') {
        throw Error('Response object can only be managed if the schema is an array or object.');
    }

    // build the schema object
    if (type === 'object') {
        return schemaObject(schema, []);
    } else {
        return schemaArray(schema, []);
    }
}

/**
 * Get a swagger response object that is isolated from a server request object. This is useful
 * when you don't have a http server that has formed the request.
 * @param {object} req The request object
 * @param {string, number} responseCode
 * @param {string} swaggerFilePath
 */
SwaggerResponse.lambda = function(req, responseCode, swaggerFilePath) {

    //validate input parameters
    if (!req || typeof req !== 'object') return Promise.reject('Invalid request object: ' + req);
    if (!/\.(?:json|yaml)$/i.test(swaggerFilePath)) return Promise.reject('The swagger definition file path must be either a .yaml or .json file.');

    return readFile(swaggerFilePath, 'utf8')
        .then(function(content) {
            const swaggerObject = /\.json$/i.test(swaggerFilePath) ?
                JSON.parse(content) :
                yaml.safeLoad(content);

            // set request defaults
            if (!req.hasOwnProperty('headers')) req.headers = {};
            if (!req.headers.hasOwnProperty('content-type')) req.headers['content-type'] =
                swaggerObject.hasOwnProperty('produces') && Array.isArray(swaggerObject.produces) && swaggerObject.produces.length > 0 ?
                    swaggerObject.produces[0] :
                    'application/json';;
            if (!req.hasOwnProperty('method')) req.method = 'GET';
            if (!req.hasOwnProperty('url')) req.url = '/';

            return metadata(req, swaggerObject);
        })
        .then(function() {
            return SwaggerResponse(req, responseCode);
        });
};

/**
 * Look for property values that are strings and perform variable value substitution. If a
 * string has a "{varName}" in it and the data object has a "varName" property then the
 * value from that property is cast to a string and injected in place of "{varName}".
 * @param {boolean} [recursive=true] Whether to recursively look for strings in sub-objects.
 * @param {object, object[]} obj The object (or objects) to perform substitution on.
 * @param {object} data The data object to use to identify string substitutions and to
 * provide values.
 */
SwaggerResponse.injectParameters = function(recursive, obj, data) {

    if (arguments.length === 2) {
        obj = arguments[0];
        data = arguments[1];
        recursive = true;
    }

    return inject(recursive, obj);

    function inject(recursive, obj) {
        const array = Array.isArray(obj) ? obj : [obj];
        array.forEach(function(item) {
            if (item && typeof item === 'object') {
                Object.keys(item).forEach(function(key) {
                    var value = item[key];
                    if (typeof value === 'string') {
                        value = SwaggerResponse.injectParameterPattern(value, data);
                        item[key] = value;
                    } else if (recursive && value && typeof value === 'object') {
                        inject(true, value);
                    }
                });
            }
        });
    }
};

/**
 * Some pre-programmed injector patterns to use for replacing placeholder values with actual values.
 * @type {{colon, doubleHandlebar, handlebar}}
 */
SwaggerResponse.injectorPatterns = {
    colon: injectorReplacement(function() { return /:([_$a-z][_$a-z0-9]*)/ig }),
    doubleHandlebar: injectorReplacement(function() { return /{{([_$a-z][_$a-z0-9]*)}}/ig }),
    handlebar: injectorReplacement(function() { return /{([_$a-z][_$a-z0-9]*)}/ig })
};

/**
 * Set the default injector pattern to use handlebar replacement.
 */
SwaggerResponse.injectParameterPattern = SwaggerResponse.injectorPatterns.handlebar;

/**
 * Determine whether the response can be managed. This will be false unless the response schema returns
 * an object or an array.
 * @param {IncomingMessage} req
 * @param {string, number} [responseCode=default]
 * @returns {boolean}
 */
SwaggerResponse.manageable = function(req, responseCode) {
    try {
        if (arguments.length === 1) responseCode = 'default';
        responseCode = '' + responseCode;
        const responses = getPropertyChainValue(req, 'swagger.operation.responses', '');
        const schema = getPropertyChainValue(responses, responseCode + '.schema', '');
        const type = getPropertyType(schema);
        return type === 'object' || type === 'array';
    } catch (e) {
        return false;
    }
};

/**
 * Set the swagger file definition path.
 * @param {string} filePath
 */
SwaggerResponse.swaggerFile = function(filePath) {
    if (typeof filePath !== 'string' || !/\.(?:json|yaml)$/i.test(filePath)) {
        throw Error('The swagger file path must be the file path to either the json or yaml swagger definition file.');
    } else {
        const content = fs.readFileSync(filePath, 'utf8');
        swaggerObject = /\.json$/i.test(config.swagger) ?
            JSON.parse(content) :
            yaml.safeLoad(content);
    }
};


function schemaArray(schema, chain) {
    const prop = schema.items;
    const hasProperties =  prop.hasOwnProperty('properties');
    const prototype = Object.create(Array.prototype);
    const store = [];
    const type = getPropertyType(prop);
    const validator = getValidateFunction(schema.items, chain);
    var prevLength = 0;

    function updateIndexGetSet() {
        var i;
        if (prevLength <= store.length) {
            for (i = prevLength; i <= store.length; i++) {
                (function(index) {
                    Object.defineProperty(obj, index, {
                        enumerable: true,
                        configurable: true,
                        get: function () {
                            return obj.get(index);
                        },
                        set: function (value) {
                            return obj.set(index, value);
                        }
                    });
                })(i);
            }
        } else {
            for (i = prevLength; i > store.length; i--) {
                (function(index) {
                    Object.defineProperty(obj, index, {
                        enumerable: false,
                        configurable: true,
                        get: function() {
                            return void 0;
                        }
                    });
                })(i);
            }
        }
        prevLength = store.length;
    }

    // TODO: add proxy support - once NodeJS has proxies

    // define length property
    Object.defineProperty(prototype, 'length', {
        get: function() {
            return store.length;
        }
    });

    // define the fill function
    prototype.fill = function(value, start, end) {
        if (arguments.length < 2) start = 0;
        if (arguments.length < 3) end = store.length;
        for (var i = start; i < end; i++) obj.set(i, value);
    };

    // define the push function
    prototype.push = function() {
        for (var i = 0; i < arguments.length; i++) {
            obj.set(store.length, arguments[i]);
        }
    };

    // define the splice function
    prototype.splice = function(start, deleteCount) {
        const args = [ start, deleteCount ];
        var i;
        for (i = 2; i < arguments.length; i++) args.push(null);
        store.splice.apply(store, args);
        for (i = 2; i < arguments.length; i++) {
            var index = start + i - 2;
            obj.set(store[index], arguments[i]);
        }
    };

    // define the unshift property
    prototype.unshift = function (args) {
        store.unshift.apply(store, arguments);
        for (var i = 0; i < arguments.length; i++) obj.set(i, arguments[i]);
    };

    // define the get function
    prototype.get = function(index) {
        return store[index];
    };

    // define the set function
    prototype.set = function(index, value) {
        // run the validator
        validator(value, '[' + index + ']');

        if (type === 'object' && hasProperties) {
            store[index] = schemaObject(schema.items, chain.concat([ index ]));
            Object.keys(value).forEach(function (k) {
                store[index][k] = value[k];
            });
        } else {
            store[index] = value;
        }

        updateIndexGetSet();
    };

    /**
     * Get JSON object representation.
     * @returns {Array}
     */
    prototype.toJSON = function() {
        return store.slice(0);
    };

    const obj = Object.create(prototype);
    updateIndexGetSet();
    return obj;
}


function schemaObject(schema, chain) {
    const obj = {};
    const store = {};

    Object.keys(schema.properties).forEach(function(key) {
        const prop = schema.properties[key];
        const hasProperties =  prop.hasOwnProperty('properties');
        const type = getPropertyType(prop);
        const validator = getValidateFunction(prop, chain.concat([key]));

        Object.defineProperty(obj, key, {
            enumerable: true,
            get: function() {
                return store[key];
            },
            set: function(value) {
                // run the validator
                validator(value);

                if (type === 'object' && hasProperties) {
                    Object.keys(value).forEach(function (k) {
                        obj[key][k] = value[k];
                    });
                } else {
                    store[key] = value;
                }
            }
        });

        if (type === 'array') {
            store[key] = schemaArray(prop, chain);
        } else if (type === 'object' && hasProperties) {
            store[key] = schemaObject(prop, chain.concat([key]));
        } else {
            store[key] = void 0;
        }

        // set default
        if (prop.hasOwnProperty('default')) obj[key] = prop.default;

    });

    if (schema.hasOwnProperty('properties')) Object.freeze(obj);
    return obj;
}

/**
 * Get all properties for an object, whether own properties, inherited, or non-enumerable.
 * @param obj
 * @returns {string[]}
 */
function getAllProperties(obj){
    const allProps = [];
    var curr = obj;
    do{
        var props = Object.getOwnPropertyNames(curr);
        props.forEach(function(prop){
            if (allProps.indexOf(prop) === -1) allProps.push(prop);
        })
    } while(curr = Object.getPrototypeOf(curr));
    return allProps
}

/**
 * Take an array of strings and numbers and turn it into a property chain equivalent as a string.
 * @param {Array.<string, number>} chain
 * @returns {string}
 */
function getChainValue(chain) {
    return chain
        .reduce(function(result, curr) {
            if (typeof curr === 'number') {
                result += '[' + curr + ']';
            } else {
                result += result.length > 0 ? '.' + curr : curr;
            }
            return result;
        }, '');
}

/**
 * Get the type from the property.
 * @param {object} property
 * @returns {string}
 */
function getPropertyType(property) {
    return property.hasOwnProperty('type') ? property.type : property.hasOwnProperty('properties') ? 'object' : 'undefined';
}

/**
 * Get the property value at the end of a property chain. Using this method throw better
 * errors if they are encountered.
 * @param {object} root
 * @param {string} chain
 * @param {string} pathToRoot
 * @returns {*}
 */
function getPropertyChainValue(root, chain, pathToRoot) {
    const chainAr = chain.split('.');

    var path = pathToRoot;
    var o = root;
    while (chainAr.length) {
        var key = chainAr.shift();
        if (key in o) {
            path += (path.length > 0 ? '.' : '') + key;
            o = o[key];
        } else {
            throw Error('Unexpected object structure. ' + key + ' does not exist ' +
                (path.length > 0 ? ' at ' + path : '') +
                ' in ' + root);
        }
    }

    return o;
}

/**
 * Get a function that will validate the value intended for a property.
 * @param property
 * @param chain
 * @returns {Function}
 */
function getValidateFunction(property, chain) {
    const fullChain = getChainValue(chain);
    const type = getPropertyType(property);

    function validate(value) {
        var i;
        var found;

        // validate type
        if (type === 'array' && !Array.isArray(value)) return 'Invalid type';
        if (typeof value !== type) return 'Invalid type';

        // validate number value
        if (type === 'number') {

            // validate maximum
            if (property.hasOwnProperty('maximum')) {
                if (property.exclusiveMaximum && value === property.maximum) return 'Value ' + value + ' over exclusive maximum ' + property.maximum;
                if (value > property.maximum) return 'Value ' + value + ' over ' + (property.exclusiveMaximum ? 'exclusive ' : '') + 'maximum ' + property.maximum;
            }

            // validate minimum
            if (property.hasOwnProperty('minimum')) {
                if (property.exclusiveMinimum && value === property.minimum) return 'Value ' + value + ' under exclusive minimum ' + property.minimum;
                if (value < property.minimum) return 'Value ' + value + ' under ' + (property.exclusiveMinimum ? 'exclusive ' : '') + 'minimum ' + property.minimum;
            }

            // validate multiple of
            if (property.hasOwnProperty('multipleOf') && value % property.multipleOf !== 0) return 'Value ' + value + ' not a multiple of ' + property.multipleOf;

        }

        // validate string value
        if (type === 'string') {

            // validate max length
            if (property.hasOwnProperty('maxLength') && value.length > property.maxLength) return 'Value ' + value + ' has length (' + value.length + ') above max length ' + property.maxLength;

            // validate min length
            if (property.hasOwnProperty('minLength') && value.length < property.minLength) return 'Value ' + value + ' has length (' + value.length + ') below min length ' + property.minLength;

            // validate pattern
            if (property.hasOwnProperty('pattern') && !(new RegExp(property.pattern)).test(value)) return 'Value ' + value + ' does not match pattern ' + property.pattern;
        }

        // enum validation
        /*if (Array.isArray(property.enum)) {
            found = false;
            for (i = 0; i < property.enum.length; i++) {
                if (valuesAreEqual(value, property.enum[i])) {
                    found = true;
                    break;
                }
            }
            if (!found) return 'Value ' + value + ' does not match enum ' + property.enum;
        }*/
    }

    return function(value, key) {
        var error = validate(value);
        if (!key) key = '';
        if (error) throw Error('Invalid value for ' + fullChain + key + ': ' + error);
    };
}

function injectorReplacement(rxGenerator) {
    return function(value, data) {
        var rx = rxGenerator();
        var match;
        var property;
        while (match = rx.exec(value)) {
            property = match[1];
            if (data.hasOwnProperty(property)) {
                value = value.replace(match[0], data[property]);
            }
        }
        return value;
    };
}

function valuesAreEqual(v1, v2) {
    var i;
    var k;
    if (v1 === v2) {
        return true;
    } else if (Array.isArray(v1) && Array.isArray(v2)) {
        if (v1.length !== v2.length) return false;
        for (i = 0; i < v1.length; i++) {
            if (!valuesAreEqual(v1[i], v2[i])) return false;
        }
        return true;
    } else if (typeof v1 === 'object' && typeof v2 === 'object') {
        const v1Keys = Object.keys(v1);
        const v2Keys = Object.keys(v2);
        if (v1Keys.length !== v2Keys.length) return false;
        for (i = 0; i < v1Keys.length; i++) {
            k = v1Keys[i];
            if (!v2.hasOwnProperty(k)) return false;
            if (!valuesAreEqual(v1[k], v2[k])) return false;
        }
        return true;
    } else {
        return false;
    }
}