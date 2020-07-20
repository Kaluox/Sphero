/**
 * Created by Eugene A. Molchanov
 * Date: 12.06.15
 * github.com/emolchanov
 */

var nodeModulesDir = "node_modules";

var fs = require("fs");
var cp = require("child_process");
var async = require("async");
var rimraf = require("rimraf");
var svn = require("svn-interface");
var colors = require('colors/safe');

var cacheFile = __dirname + "/../.cache";
var rootDir = __dirname + "/../../..";
var pkg = require(rootDir + "/package.json");
var pkgDeps = pkg.svnDependencies || {};
var svnOptions = pkg.svnOptions || {};
var deps = {};
var dep = "";
var errors = [];
var numDeps;
var CACHEBUFFER = [];

Object.keys(pkgDeps).forEach(function (dep) {
    deps[dep] = buildDepObj(dep, pkgDeps);
});

numDeps = Object.keys(deps).length;

async.each(deps, function (dep, cb) {
    async.series([
        validateCache(dep),
        mkdirs(dep),
        checkout(dep),
        cleanup(dep),
        update(dep),
        cleanup(dep),
        writeToCache(dep),
        npmInstall(dep)
    ], info(dep, cb));
}, function () {
    writeBufferToCache();
});

function buildDepObj(str, deps) {
    var out = {};
    out.repo = deps[str];
    if (str.indexOf("@") > 0 && str.indexOf("|") == -1) {
        str = /^(.*)@(.*)$/.exec(str);
        out.name = str[1];
        out.tag = str[2];
        out.rev = "HEAD";
        if (out.tag.toLowerCase() != "trunk") out.repo = out.repo + "/tags/";
    } else if (str.indexOf("@") > 0 && str.indexOf("|") > 0) {
        str = /^(.*)@(.*)\|(.*)$/.exec(str);
        out.name = str[1];
        out.tag = str[2];
        out.rev = str[3];
        if (out.tag.toLowerCase() != "trunk") out.repo = out.repo + "/tags/";
    } else if(out.repo.indexOf("/trunk/") > 0) {
        out.name = str;
        out.tag = "";
        out.rev = "HEAD";
    } else {
        out.name = str;
        out.tag = "";
        out.rev = "HEAD";
    }
    out.COPath = out.repo + "/" + out.tag;
    out.installDir = nodeModulesDir + "/" + out.name + "/";
    return out;
}

function writeToCache(dep) {
    return function (callback) {
        CACHEBUFFER.push(dep);
        callback(null);
    }
}

function writeBufferToCache() {
    var data = readCache();
    CACHEBUFFER.forEach(function (dep) {
        data[dep.name] = dep;
    });
    return writeCache(data)(function () {
    });
}

function writeCache(data) {
    return function (callback) {
        fs.writeFile(cacheFile, JSON.stringify(data), function (error, result) {
            callback(error)
        })
    }
}

function readCache() {
    return fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
}

function validateCache(dep) {
    return function (callback) {
        var data = readCache();
        var depCache = data[dep.name];
        if (depCache) {
            dep.latest = (depCache.tag === dep.tag && depCache.rev === dep.rev) ? true : false;
        }
        return callback(null);
    }
}

function mkdirs(dep) {
    return function (callback) {
        if (dep.latest) callback(null);
        else async.waterfall([
                function (cb) {
                    fs.exists(rootDir + "/" + nodeModulesDir, function (exists) {
                        cb(null, exists);
                    });
                },
                function (exists, cb) {
                    if (!exists)
                        fs.mkdir(rootDir + "/" + nodeModulesDir, function (error) {
                            cb(error);
                        });
                    else
                        cb(null);
                },
                function (cb) {
                    fs.exists(rootDir + "/" + dep.installDir, function (exists) {
                        cb(null, exists);
                    });
                },
                function (exists, cb) {
                    if (exists)
                        rimraf(rootDir + "/" + dep.installDir, function (error) {
                            cb(error);
                        });
                    else
                        cb(null);
                }
            ],
            function (error) {
                callback(error);
            }
        );
    };
}

function checkout(dep) {
    return function (callback) {
        console.log(colors.green("Checking"), colors.yellow(dep.name), "rev=" + dep.rev, "from", dep.COPath);
        if (dep.latest) callback(null);
        else svn.checkout(dep.COPath, rootDir + "/" + dep.installDir,
            Object.assign({revision: dep.rev}, svnOptions),
            function (error, result) {
            return callback(error ? result : null)
        })
    }
}

function update(dep) {
    return function (callback) {
        return svn.update(rootDir + "/" + dep.installDir,
            Object.assign({revision: dep.rev}, svnOptions),
            function (error, result) {
            //console.log("UP", result);
            return callback(error ? result : null)
        })
    }
}

function cleanup(dep) {
    return function (callback) {
        return svn.cleanup(rootDir + "/" + dep.installDir, svnOptions, function (error, result) {
            //console.log("Cleanup", result);
            return callback(error ? result : null)
        })
    }
}

function npmInstall(dep) {
    return function (callback) {
        var eKeys = Object.keys(process.env),
            env = {}, i;
        //console.log("Running `npm install` on " + dep.name + "...");

        for (i = eKeys.length; i--;) {
            if (!/^npm_/i.test(eKeys[i])) {
                env[eKeys[i]] = process.env[eKeys[i]];
            }
        }

        cp.exec("npm install --production", {
            stdio: "inherit",
            cwd: rootDir + "/" + dep.installDir,
            env: env
        }, function (error) {
            callback(error ? "npm install failed" : null);
        });
    };
}

function info(dep, cb) {
    return function (error) {
        if (error) {
            console.log(colors.red("Failed to install " + dep.name));
            errors.push(dep.name + " (" + error + ")");
        }

        if (!error) console.log(colors.green("\nInstalled ") + colors.yellow(dep.name) + "@" + dep.tag + "|" + dep.rev, dep.installDir);

        if (0 === --numDeps) {
            if (errors.length) {
                console.log(colors.red("\nEncountered errors installing svn dependencies:"));
                errors.forEach(function (err) {
                    console.log(colors.red(" * " + err));
                });
                console.log("\n");
            } else {
                console.log(colors.green("\nFinished installing svn dependencies"));
            }
        }
        cb();
    };
}
