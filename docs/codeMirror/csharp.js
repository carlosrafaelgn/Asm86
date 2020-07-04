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

	CodeMirror.defineMIME("text/csharp", {
		name: "clike",
		keywords: words("bool break byte case catch char checked class const continue default do double else enum finally float for get if in int interface long namespace new out private protected public readonly ref return set static string switch this throw try typeof uint ulong unchecked using var void while"),
		blockKeywords: words("catch class do else enum finally for get if namespace set switch try using while"),
		atoms: words("false true null"),
		classes: words("Array CultureInfo DateTime Encoding Exception HttpCookie MailMessage NetworkCredential SmtpClient SqlCommand SqlConnection SqlDataReader Uri"),
		hooks: {}
	});
})();
