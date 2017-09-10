"use strict";
const expect        = require('chai').expect;
const fs            = require('fs');
const Response      = require('../bin/swagger-response');

describe('swagger-response-2.0', function() {

    describe('#', function() {

        describe('response code', function() {
            var definitionContent;
            var req;

            before(function(done) {
                fs.readFile(__dirname + '/resources/partial/response-code.json', 'utf8', function(err, data) {
                    if (err) return done(err);
                    definitionContent = data;
                    done();
                })
            });

            beforeEach(function() {
                req = { swagger: JSON.parse(definitionContent) };
            });

            it('found default without specifying response code', function() {
                var response = Response(req);
                expect(response).to.have.ownProperty('isDefault');
            });

            it('found default with specifying response code', function() {
                var response = Response(req, 'default');
                expect(response).to.have.ownProperty('isDefault');
            });

            it('found 200 with specifying response code as number', function() {
                var response = Response(req, 200);
                expect(response).to.have.ownProperty('is200');
            });

            it('found 200 with specifying response code as string', function() {
                var response = Response(req, '200');
                expect(response).to.have.ownProperty('is200');
            });

            it('could not find non-existent code', function() {
                expect(function() { Response(req, '100'); }).to.throw(Error);
            });

        });

        describe('object', function() {
            var definitionContent;
            var response;

            before(function(done) {
                fs.readFile(__dirname + '/resources/partial/object.json', 'utf8', function(err, data) {
                    if (err) return done(err);
                    definitionContent = data;
                    done();
                })
            });

            beforeEach(function() {
                const req = { swagger: JSON.parse(definitionContent) };
                response = Response(req, 200);
            });

            it('boolean accepts boolean', function() {
                expect(function() { response.boolean = true }).to.not.throw(Error);
                expect(response.boolean).to.equal(true);
            });

            it('boolean does not accept number', function() {
                expect(function() { response.boolean = 1 }).to.throw(Error);
            });

            it('string accepts string', function() {
                expect(function() { response.string = 'foo' }).to.not.throw(Error);
                expect(response.string).to.equal('foo');
            });

            it('string validates on pattern', function() {
                expect(function() { response.string = 'bar' }).to.throw(Error);
            });

            it('string validates on min length', function() {
                expect(function() { response.string = 'f' }).to.throw(Error);
            });

            it('string validates on max length', function() {
                expect(function() { response.string = 'foofoofoo' }).to.throw(Error);
            });

            it('number accepts number', function() {
                expect(function() { response.number = 1 }).to.not.throw(Error);
                expect(response.number).to.equal(1);
            });

            it('number validates on minimum', function() {
                expect(function() { response.number = -1 }).to.throw(Error);
            });

            it('number validates on exclusive minimum', function() {
                expect(function() { response.number = 0 }).to.throw(Error);
            });

            it('number validates on maximum', function() {
                expect(function() { response.number = 11 }).to.throw(Error);
            });

            it('number validates on exclusive maximum', function() {
                expect(function() { response.number2 = 10 }).to.throw(Error);
            });

            it('cannot set non-defined property', function() {
                expect(function() { response.number3 = 5; }).to.throw(Error);
            });

        });

        describe('object within object', function() {
            var definitionContent;
            var response;

            before(function(done) {
                fs.readFile(__dirname + '/resources/partial/object-within-object.json', 'utf8', function(err, data) {
                    if (err) return done(err);
                    definitionContent = data;
                    done();
                })
            });

            beforeEach(function() {
                const req = { swagger: JSON.parse(definitionContent) };
                response = Response(req, 200);
            });

            it('string fails', function() {
                expect(function() { response.foo = 'foo'; }).to.throw(Error);
            });

            it('empty object passes', function() {
                var o = {};
                expect(function() { response.foo = o; }).to.not.throw(Error);
                expect(response.foo).to.haveOwnProperty('string');
                expect(response.foo.string).to.equal(undefined);
            });

            it('invalid object fails', function() {
                var o = { string: true };
                expect(function() { response.foo = o; }).to.throw(Error);
            });

            it('valid object passes', function() {
                var o = { string: 'string' };
                expect(function() { response.foo = o; }).to.not.throw(Error);
                expect(response.foo).to.deep.equal(o);
            });
        });

        describe('array of strings', function() {
            var definitionContent;
            var response;

            before(function(done) {
                fs.readFile(__dirname + '/resources/partial/array-of-strings.json', 'utf8', function(err, data) {
                    if (err) return done(err);
                    definitionContent = data;
                    done();
                })
            });

            beforeEach(function() {
                const req = { swagger: JSON.parse(definitionContent) };
                response = Response(req, 200);
            });

            it('initializes to empty array', function() {
                var str = JSON.stringify(response);
                expect(str).to.equal('[]');
            });

            it('add empty string to array passes', function() {
                response.push('');
                var str = JSON.stringify(response);
                expect(str).to.equal('[""]');
            });

            it('add string to array passes', function() {
                response.push('hello');
                var str = JSON.stringify(response);
                expect(str).to.equal('["hello"]');
            });

            it('add number to array fails', function() {
                expect(function() { response.push(5); }).to.throw(Error);
            });

            it('add valid item by index passes', function() {
                expect(function() { response[0] = 'hello'; }).to.not.throw(Error);
                expect(response[0]).to.equal('hello');
            });

            it('add invalid item by index fails', function() {
                expect(function() { response[0] = 1; }).to.throw(Error);
            });

        });

        describe('array of objects', function() {
            var definitionContent;
            var response;

            before(function(done) {
                fs.readFile(__dirname + '/resources/partial/array-of-objects.json', 'utf8', function(err, data) {
                    if (err) return done(err);
                    definitionContent = data;
                    done();
                })
            });

            beforeEach(function() {
                const req = { swagger: JSON.parse(definitionContent) };
                response = Response(req, 200);
            });

            it('initializes to empty array', function() {
                var str = JSON.stringify(response);
                expect(str).to.equal('[]');
            });

            it('add empty object passes', function() {
                expect(function() {
                    response.push({});
                }).to.not.throw(Error);
            });

            it('add object with valid property passes', function() {
                expect(function() { response.push({ city: 'Foo' }); }).to.not.throw(Error);
            });

            it('update object at index with valid property passes', function() {
                expect(function() {
                    response.push({ city: 'Foo' });
                    response.get(0).zipcode = 123456;
                }).to.not.throw(Error);
            });

            it('add object with invalid property fails', function() {
                expect(function() { response.push({ foo: 'Foo' }); }).to.throw(Error);
            });
        });

    });

    describe('#injectParameters', function() {
        var obj;

        beforeEach(function() {
            obj = {
                foo: 'asdf{foo}jkl',
                bar: {
                    baz: 'qwer{foo}uiop'
                }
            };
        });

        it('recursive defaults to true', function() {
            Response.injectParameters(obj, { foo: '***'});
            expect(obj.foo).to.equal('asdf***jkl');
            expect(obj.bar.baz).to.equal('qwer***uiop');
        });

        it('recursive can be set to false', function() {
            Response.injectParameters(false, obj, { foo: '***'});
            expect(obj.foo).to.equal('asdf***jkl');
            expect(obj.bar.baz).to.equal('qwer{foo}uiop');
        });

        it('colon replacement', function() {
            const obj = { foo: 'asdf/:foo/jkl' };
            Response.injectParameterPattern = Response.injectorPatterns.colon;
            Response.injectParameters(obj, { foo: '***'});
            expect(obj.foo).to.equal('asdf/***/jkl');
        });

        it('double handlebar replacement', function() {
            const obj = { foo: 'asdf{{foo}}j{k}l' };
            Response.injectParameterPattern = Response.injectorPatterns.doubleHandlebar;
            Response.injectParameters(obj, { foo: '***', k: 'x'});
            expect(obj.foo).to.equal('asdf***j{k}l');
        });

        it('handlebar replacement', function() {
            const obj = { foo: 'asdf{foo}j{{k}}l' };
            Response.injectParameterPattern = Response.injectorPatterns.handlebar;
            Response.injectParameters(obj, { foo: '***', k: 'x'});
            expect(obj.foo).to.equal('asdf***j{x}l');
        });
        
    });

    describe('#manageable', function() {

        it('unmanageable', function() {
            const req = {
                swagger: {
                    operation: {
                        responses: {
                            '200': {
                                schema: {
                                    type: 'string'
                                }
                            }
                        }
                    }
                }
            };
            expect(Response.manageable(req, 200)).to.equal(false);
        });

        it('unmanageable', function() {
            const req = {
                swagger: {
                    operation: {
                        responses: {
                            '200': {
                                schema: {
                                    type: 'object'
                                }
                            }
                        }
                    }
                }
            };
            expect(Response.manageable(req, 200)).to.equal(true);
        });

    });
    
});

