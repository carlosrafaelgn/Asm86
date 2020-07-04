CodeMirror.defineMode("clike", function (config, parserConfig) {
	var indentUnit = config.indentUnit,
		statementIndentUnit = parserConfig.statementIndentUnit || indentUnit,
		dontAlignCalls = parserConfig.dontAlignCalls,
		keywords = parserConfig.keywords || {},
		builtin = parserConfig.builtin || {},
		blockKeywords = parserConfig.blockKeywords || {},
		atoms = parserConfig.atoms || {},
		classes = parserConfig.classes || {},
		hooks = parserConfig.hooks || {},
		multiLineStrings = parserConfig.multiLineStrings;
	var isOperatorChar = /[+\-*&%=<>!?|\/]/;

	var curPunc;

	function tokenBase(stream, state) {
		var ch = stream.next();
		if (hooks[ch]) {
			var result = hooks[ch](stream, state);
			if (result !== false) return result;
		}
		if (ch == '"' || ch == "'") {
			state.tokenize = tokenString(ch);
			return state.tokenize(stream, state);
		}
		if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
			curPunc = ch;
			return "operator"; //null;
		}
		if (/\d/.test(ch)) {
			stream.eatWhile(/[\w\.]/);
			return "number";
		}
		if (ch == "/") {
			if (stream.eat("*")) {
				state.tokenize = tokenComment;
				return tokenComment(stream, state);
			}
			if (stream.eat("/")) {
				stream.skipToEnd();
				return "comment";
			}
		}
		if (isOperatorChar.test(ch)) {
			stream.eatWhile(isOperatorChar);
			return "operator";
		}
		stream.eatWhile(/[\w\$_]/);
		var cur = stream.current();
		if (keywords.propertyIsEnumerable(cur)) {
			if (blockKeywords.propertyIsEnumerable(cur)) curPunc = "newstatement";
			return "keyword";
		}
		if (builtin.propertyIsEnumerable(cur)) {
			if (blockKeywords.propertyIsEnumerable(cur)) curPunc = "newstatement";
			return "builtin";
		}
		if (atoms.propertyIsEnumerable(cur)) return "atom";
		if (classes.propertyIsEnumerable(cur)) return "classes";
		return "variable";
	}

	function tokenString(quote) {
		return function (stream, state) {
			var escaped = false, next, end = false;
			while ((next = stream.next()) != null) {
				if (next == quote && !escaped) { end = true; break; }
				escaped = !escaped && next == "\\";
			}
			if (end || !(escaped || multiLineStrings))
				state.tokenize = null;
			return "string";
		};
	}

	function tokenComment(stream, state) {
		var maybeEnd = false, ch;
		while (ch = stream.next()) {
			if (ch == "/" && maybeEnd) {
				state.tokenize = null;
				break;
			}
			maybeEnd = (ch == "*");
		}
		return "comment";
	}

	function Context(indented, column, type, align, prev) {
		this.indented = indented;
		this.column = column;
		this.type = type;
		this.align = align;
		this.prev = prev;
	}
	function pushContext(state, col, type) {
		var indent = state.indented;
		if (state.context && state.context.type == "statement")
			indent = state.context.indented;
		return state.context = new Context(indent, col, type, null, state.context);
	}
	function popContext(state) {
		var t = state.context.type;
		if (t == ")" || t == "]" || t == "}")
			state.indented = state.context.indented;
		return state.context = state.context.prev;
	}

	// Interface

	return {
		startState: function (basecolumn) {
			return {
				tokenize: null,
				context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
				indented: 0,
				startOfLine: true
			};
		},

		token: function (stream, state) {
			var ctx = state.context;
			if (stream.sol()) {
				if (ctx.align == null) ctx.align = false;
				state.indented = stream.indentation();
				state.startOfLine = true;
			}
			if (stream.eatSpace()) return null;
			curPunc = null;
			var style = (state.tokenize || tokenBase)(stream, state);
			if (style == "comment" || style == "meta") return style;
			if (ctx.align == null) ctx.align = true;

			if ((curPunc == ";" || curPunc == ":" || curPunc == ",") && ctx.type == "statement") popContext(state);
			else if (curPunc == "{") pushContext(state, stream.column(), "}");
			else if (curPunc == "[") pushContext(state, stream.column(), "]");
			else if (curPunc == "(") pushContext(state, stream.column(), ")");
			else if (curPunc == "}") {
				while (ctx.type == "statement") ctx = popContext(state);
				if (ctx.type == "}") ctx = popContext(state);
				while (ctx.type == "statement") ctx = popContext(state);
			}
			else if (curPunc == ctx.type) popContext(state);
			else if (((ctx.type == "}" || ctx.type == "top") && curPunc != ';') || (ctx.type == "statement" && curPunc == "newstatement"))
				pushContext(state, stream.column(), "statement");
			state.startOfLine = false;
			return style;
		},

		indent: function (state, textAfter) {
			if (state.tokenize != tokenBase && state.tokenize != null) return CodeMirror.Pass;
			var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
			if (ctx.type == "statement" && firstChar == "}") ctx = ctx.prev;
			var closing = firstChar == ctx.type;
			if (ctx.type == "statement") return ctx.indented + (firstChar == "{" ? 0 : statementIndentUnit);
			else if (dontAlignCalls && ctx.type == ")" && !closing) return ctx.indented + statementIndentUnit;
			else if (ctx.align) return ctx.column + (closing ? 0 : 1);
			else return ctx.indented + (closing ? 0 : indentUnit);
		},

		electricChars: "{}"
	};
});

(function () {
	function words(str) {
		var obj = {}, words = str.split(" ");
		for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
		return obj;
	}

	CodeMirror.defineMIME("text/javascript", {
		name: "clike",
		keywords: words("Array Boolean break case catch class const continue default do else enum extends finally for function if implements import in instanceof interface new Number private protected public return static String switch this throw throws try typeof var void while with"),
		blockKeywords: words("catch class do else enum finally for if switch try while"),
		atoms: words("Infinity NaN false fgets null printf scanf true undefined"),
		classes: {},
		hooks: {}
	});
})();

/*CodeMirror.defineMode("javascript", function () {
	var keywords = /^(if|else|do|while|for|var|in|try|catch|finally|new|Array|delete|throw|break|continue|switch|default|with|typeof|instanceof|prototype|true|false|null|undefined|Infinity|printf|scanf|fgets)\b/i;
	var numbers = /^(0x[0-9a-f]*|[0-9]+|[0-9]+e[0-9]*)\b/i;

	return {
		startState: function (basecolumn) {
			return {
				align: null,
				stringQuote: null,
				context: new Context((basecolumn || 0), 0, "top", false),
				startOfLine: true
			};
		},
		tokenString: function (stream, state) {
			var escaped = false, next, end = false;
			while ((next = stream.next()) != null) {
				if (next == quote && !escaped) { end = true; break; }
				escaped = !escaped && next == "\\";
			}
			if (end || !(escaped || multiLineStrings))
				state.tokenize = null;
			return "string";
		},
		token: function (stream, state) {
			var ctx = state.context;
			if (stream.sol()) {
				if (ctx.align == null)
					ctx.align = false;
				state.indented = stream.indentation();
				state.startOfLine = true;
			}
			if (stream.eatSpace())
				return null;
			if (state.stringQuote) {

			}
			var w;
			if (stream.eat("/")) {
				if (stream.eat("/")) {
					stream.skipToEnd();
					return "comment";
				} else {
					return "operator";
				}
			} else if (stream.eat("\"")) {
				state.stringQuote = "\"";
				return this.tokenString(stream, state);
			} else if (stream.eat("\'")) {
				state.stringQuote = "\'";
				return this.tokenString(stream, state);
			//} else if (stream.eat("\"")) {
			//	stream.skipTo("\"");
			//	stream.eat("\"");
			//	return "string";
			//} else if (stream.eat("\'")) {
			//	stream.skipTo("\'");
			//	stream.eat("\'");
			//	return "string";
			} else if (stream.eat("+") ||
				stream.eat("-") ||
				stream.eat("*") ||
				stream.eat("%") ||
				stream.eat("!") ||
				stream.eat("~") ||
				stream.eat("(") ||
				stream.eat(")") ||
				stream.eat("[") ||
				stream.eat("]") ||
				stream.eat("{") ||
				stream.eat("}") ||
				stream.eat("<") ||
				stream.eat(">") ||
				stream.eat("=") ||
				stream.eat("^") ||
				stream.eat("&") ||
				stream.eat("|") ||
				stream.eat("?") ||
				stream.eat(":") ||
				stream.eat(".") ||
				stream.eat(",") ||
				stream.eat(";")) {
				return "operator";
			} else if (stream.eatWhile(/\w/)) {
				w = stream.current();
				if (keywords.test(w)) {
					return "keyword";
				} else if (numbers.test(w)) {
					return "number";
				} else {
					return null;
				}
			} else {
				stream.next();
			}
			return null;
		}
	};
});

CodeMirror.defineMIME("text/plain", "txt");*/
