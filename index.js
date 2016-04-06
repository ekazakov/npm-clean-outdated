var path = require('path');
var Promise = require('bluebird');
var npm = Promise.promisifyAll(require('npm'));

function rawPromisify(obj) {
    Object.keys(obj).forEach(function (name) {
        var method = obj[name];

        if (typeof method === 'function') {
            obj[name + 'Async'] = function () {
                var args = [].slice.call(arguments);
                var that = this;
                return new Promise(function (resolve, reject) {
                    args.push(function (err, results) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(results);
                        }
                    });
                    return method.apply(that, args);
                });
            };
        }
    });
}

function makeJSON (list) {
    var out = {};

    list.forEach(function (p) {
        var dep = p[0];
        var depname = p[1];
        var dir = dep.path;
        var has = p[2];
        var want = p[3];
        var latest = p[4];
        var type = p[6];
        if (!npm.config.get('global') && dir != null) {
            dir = path.relative(process.cwd(), dir)
        }
        out[depname] = {
            current: has,
            wanted: want,
            latest: latest,
            location: dir
        };

        out[depname].type = type;
    });
    // return JSON.stringify(out, null, 2)
    return out;
}

function filterOutdatedForPackage(modules) {
    return Object.keys(modules).reduce(function (result, key) {
        if (modules[key].current !== modules[key].wanted) {
            result[key] = modules[key];
        }

        return result;
    }, {});
}

function run() {
    npm.loadAsync({silent: true, json: false})
        .then(function () {
            rawPromisify(npm.commands)
        })
        .then(function () {
            return npm.commands.outdatedAsync([], true);
        })
        .then(makeJSON)
        .then(filterOutdatedForPackage)
        .then(function (data) {
            var modules = Object.keys(data);
            if (modules.length > 0) {
                return npm.commands.uninstallAsync(modules);
            }
        })
        .then(function () {
            npm.commands.prune();
        })
        .catch(function (err) {
            throw err;
        });
}

exports.default = {
    run: run
};

