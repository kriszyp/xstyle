define(["dojo/json", "build/fs", "../build"], function(json, fs, buildModule){
	return {
		start:function(
			mid,
			referenceModule,
			bc
		){
			// mid may contain a pragma (e.g. "!strip"); remove
			mid = mid.split("!")[0];
			var cssPlugin = bc.amdResources["xstyle/css"],
				moduleInfo = bc.getSrcModuleInfo(mid, referenceModule, true),
				cssResource = bc.resources[moduleInfo.url],
				xstyleModuleInfo = bc.getSrcModuleInfo("xstyle/xstyle", referenceModule, true),
				xstyleText = fs.readFileSync(xstyleModuleInfo.url + '.js', "utf8"),
				xstyle = buildModule(xstyleText);
				print('xstyle', xstyle);
			var text= fs.readFileSync(this.module.src, "utf8");

			if (!cssPlugin){
				throw new Error("text! plugin missing");
			}
			if (!cssResource){
				throw new Error("text resource (" + moduleInfo.url + ") missing");
			}

			var result = [cssPlugin];
			if(bc.internStrings && !bc.internSkip(moduleInfo.mid, referenceModule)){
				result.push({
					module:cssResource,
					pid:moduleInfo.pid,
					mid:moduleInfo.mid,
					deps:[],
					getText:function(){
						var text = this.module.getText ? this.module.getText() : this.module.text;
						if(text===undefined){
							// the module likely did not go through the read transform; therefore, just read it manually
							text= fs.readFileSync(this.module.src, "utf8");
						}
						var processed = xstyleProcess(text, moduleInfo.url);
						for(var i = 0; i < processed.requiredModules.length; i++){
							console.log("processed mdoules", processed.requiredModules[i]);
							//moduleInfo = bc.getSrcModuleInfo(resolvedId, referenceModule),
							//module = bc.amdResources[moduleInfo.mid];
						}
						
						return json.stringify(processed.cssText+"");
					},
					internStrings:function(){
						return ["url:" + this.mid, this.getText()];
					}
				});
			}
			return result;
		}
	};
});
