/**
 * Created by Eugene A. Molchanov
 * Date: 12.06.15
 * github.com/emolchanov
 */

var read = require("fs").readFileSync;
var write = require("fs").writeFileSync;
var check = require("fs").existsSync;
var join = require("path").join;
var relative = require("path").relative;

var moduleName = "npm-svn";
var installAction = "install";

var path = __dirname + "/../../../";

var mainScript = "scanner.js";
var mainScriptPrefix = "node ./";

var pkgFileName = "package.json";
var pkgFile = join(path, pkgFileName);

var errorMessage = "--> " + moduleName + " did not find your app's " + pkgFileName + " file";

module.exports = function (action) {
    var pkg, scripts, helperScript;
    if (check(pkgFile)) {
        scripts = [];
        pkg = JSON.parse(read(pkgFile).toString());
        pkg.scripts = pkg.scripts || {};
        pkg.scripts.install = pkg.scripts.install || "";
        pkg.scripts.install.split("&&").forEach(function (s) {
            if (-1 === s.indexOf(moduleName)) {
                s = s.trim();
                if (s.length > 0) scripts.push(s);
            }
        });
        if (installAction === action) {
            helperScript = mainScriptPrefix + relative(path, join(__dirname, mainScript));
            scripts.push(helperScript);
        }
        pkg.scripts.install = scripts.join(" && ");
        write(pkgFile, JSON.stringify(pkg, null, "\t"));
    } else {
        console.log(errorMessage);
    }
};

