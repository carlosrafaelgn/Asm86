(function () {
	function forEach(arr, f) {
		for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]);
	}

	function arrayContains(arr, item) {
		if (!Array.prototype.indexOf) {
			var i = arr.length;
			while (i--) {
				if (arr[i] === item) {
					return true;
				}
			}
			return false;
		}
		return arr.indexOf(item) != -1;
	}

	function scriptHint(editor, keywords, getToken, options) {
		// Find the token at the cursor
		var cur = editor.getCursor(), token = getToken(editor, cur), tprop = token;
		// If it's not a 'word-style' token, ignore the token.
		if (!/^[\w$_]*$/.test(token.str)) {
			token = tprop = {
				start: cur.ch, end: cur.ch, str: "", state: token.state,
				type: token.str == "." ? "property" : null
			};
		}
		// If it is a property, find out what it is a property of.
		while (tprop.type == "property") {
			tprop = getToken(editor, { line: cur.line, ch: tprop.start });
			if (tprop.str != ".") return;
			tprop = getToken(editor, { line: cur.line, ch: tprop.start });
			if (tprop.str == ')') {
				var level = 1;
				do {
					tprop = getToken(editor, { line: cur.line, ch: tprop.start });
					switch (tprop.str) {
						case ')': level++; break;
						case '(': level--; break;
						default: break;
					}
				} while (level > 0);
				tprop = getToken(editor, { line: cur.line, ch: tprop.start });
				if (tprop.type.indexOf("variable") === 0)
					tprop.type = "function";
				else return; // no clue
			}
			if (!context) var context = [];
			context.push(tprop);
		}
		return {
			list: getCompletions(token, context, keywords, options),
			from: { line: cur.line, ch: token.start },
			to: { line: cur.line, ch: token.end }
		};
	}

	CodeMirror.javascriptHint = function (editor, options) {
		return scriptHint(editor, javascriptKeywords,
						  function (e, cur) { return e.getTokenAt(cur); },
						  options);
	};

	var stringProps = ("charAt charCodeAt indexOf lastIndexOf substring substr slice trim trimLeft trimRight " +
					   "toUpperCase toLowerCase split concat match replace search").split(" ");
	var arrayProps = ("length concat join splice push pop shift unshift slice reverse sort indexOf " +
					  "lastIndexOf every some filter forEach map reduce reduceRight ").split(" ");
	var funcProps = "prototype apply call bind".split(" ");
	var javascriptKeywords = ("Array Boolean Number String break case catch class const continue default do else enum extends finally for function if implements import in instanceof interface new private protected public return static switch this throw throws try typeof var void while with").split(" ");

	function getCompletions(token, context, keywords, options) {
		var found = [], start = token.str;
		function maybeAdd(str) {
			if (str.indexOf(start) == 0 && !arrayContains(found, str)) found.push(str);
		}
		function gatherCompletions(obj) {
			if (typeof obj == "string") forEach(stringProps, maybeAdd);
			else if (obj instanceof Array) forEach(arrayProps, maybeAdd);
			else if (obj instanceof Function) forEach(funcProps, maybeAdd);
			//for (var name in obj) maybeAdd(name);
		}

		if (context) {
			// If this is a property, see if it belongs to some object we can
			// find in the current environment.
			var obj = context.pop(), base;
			if (obj.type.indexOf("variable") === 0) {
				if (options && options.additionalContext)
					base = options.additionalContext[obj.str];
				base = base || window[obj.str];
			} else if (obj.type == "string") {
				base = "";
			} else if (obj.type == "atom") {
				base = 1;
			} else if (obj.type == "function") {
				if (window.jQuery != null && (obj.str == '$' || obj.str == 'jQuery') &&
					(typeof window.jQuery == 'function'))
					base = window.jQuery();
				else if (window._ != null && (obj.str == '_') && (typeof window._ == 'function'))
					base = window._();
			}
			while (base != null && context.length)
				base = base[context.pop().str];
			if (base != null) gatherCompletions(base);
		}
		else {
			// If not, just look in the window object and any local scope
			// (reading into JS mode internals to get at the local and global variables)
			for (var v = token.state.localVars; v; v = v.next) maybeAdd(v.name);
			for (var v = token.state.globalVars; v; v = v.next) maybeAdd(v.name);
			gatherCompletions(window);
			forEach(keywords, maybeAdd);
		}
		return found;
	}
})();
