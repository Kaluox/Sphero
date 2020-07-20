var svn = require("./svn");
var util = require("util");
var spawn = require("child_process").spawn;
var fs = require("fs");
/*svn.info("/home/imccall/trunk/", function info(e, result) {
  if(e) {
    console.log("no info");
    spinner.start();
    svn.co("svn+ssh://cvs.where2getit.com/var/lib/svn/wfc-core/trunk", "/home/imccall/wfc-core/trunk/", function co(e, r) {
      spinner.stop();
      if(e) {
        console.log(r);
      }
    });
  }
});*/

svn.st("/u/w2gi", function stat(e, r) {
  console.log(util.inspect(r, {depth:7, colors:true}));
  r.status.target.entry.forEach(function(entry) {
    if(entry["wc-status"]._attribute.item !== 'unversioned') {
      console.log("%s\t%s","M", entry._attribute.path);
    }
  });
});

/*svn.ci("/u/w2gi", function ci(e, r) {
  console.log(r);
});*/
/*var index = 2;
var file = "/u/w2gi/svn-commit.tmp";
while(fs.existsSync(file)) {
  file = file.replace(/svn-commit\.\d*\.?tmp$/, "svn-commit." + index + ".tmp");
}
fs.writeFileSync(file, "\n--This line, and those below, will be ignored--\n\n");
var vim = spawn("vim", [file], {stdio: "inherit"});
vim.on('exit', function(code, sig){
  if(code === 0) {
    console.log(fs.readFileSync(file).toString());
  }
});
*/
