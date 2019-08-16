//
// Asm86 is distributed under the FreeBSD License
//
// Copyright (c) 2013, Carlos Rafael Gimenes das Neves
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met: 
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer. 
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution. 
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those
// of the authors and should not be interpreted as representing official policies, 
// either expressed or implied, of the FreeBSD Project.
//
// https://github.com/carlosrafaelgn/Asm86
//
"use strict";
//------------------------------------------------------------------------------------
// Limitations:
// - Not all instructions have been implemented
// - Not all flags have been implemented
// - No segment/paging support
// - Only 9 registers available (debug and control registers are not available)
// - No task support as nowadays OSes implement (simple tasks can still be created using time-sharing algorithms)
// - IO ports do not reflect the standard IO ports available in PC's
// - No float point/MMX/SSE... instructions
// - No advanced features like GDT, LDT
// - IDT support is limited and does not reflect the original IDT description
// - Instructions XSAVE and XRSTOR were changed and do not reflect the documented version
// - Interrupts < 32, except for int 3, are not supported
// - No instructions modifiers/prefixes, other than REP, have been implemented
// - No 3 or more operands instructions have been implemented
// - Not all CMOVcc/Jcc/SETcc instructions have been implemented
// - Neither protected mode nor virtual mode has been implemented
//------------------------------------------------------------------------------------
// I tried to be as faithful as possible to the manuals from Intel:
// (although Volumes 2C, 3A, 3B and 3C were not too much used)
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume 1 - Basic Architecture (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-1-manual.html
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 2A: Instruction Set Reference, A-M (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-2a-manual.html
// 
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 2B: Instruction Set Reference, N-Z (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-2b-manual.html
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 2C: Instruction Set Reference (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-2c-manual.html
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 3A: System Programming Guide, Part 1 (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-3a-part-1-manual.html
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 3B: System Programming Guide, Part 2 (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-3b-part-2-manual.html
//
// Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume Volume 3C: System Programming Guide, Part 3 (June 2013)
// http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-3c-part-3-manual.html
//
function Asm86EmulatorContext(errorNotificationFunction, memorySize, inputFunction, outputFunction) {
	var regBuffer;
	if (!memorySize || memorySize < 1)
		throw "Invalid memory size!";
	this.memorySize = (memorySize | 0);
	if ((this.memorySize & (this.memorySize - 1)))
		throw "Memory size must be a power of 2!";
	this.memoryLimit = this.memorySize + 1024;
	this.memory = new DataView(new ArrayBuffer(this.memorySize));
	this.ioArray = new DataView(new ArrayBuffer(4));
	this.inp = inputFunction;
	this.outp = outputFunction;
	this.pendingIO = 0; //-1 = in, 0 = none, 1 = out
	this.pendingIOreg = null;
	this.pendingIOsize = 0;
	this.halted = false;
	this.dbgReq = false;
	this.flagCarry = 0;
	this.flagDir = 0;
	this.flagI = 0;
	this.flagOv = 0;
	this.flagSign = 0;
	this.flagZ = 0;
	this.pendingInterrupts = [];
	this.idt = 0;
	this.errorNotificationFunction = errorNotificationFunction;
	regBuffer = new DataView(new ArrayBuffer(9 << 2));
	this.regs = {
		eax: Asm86EmulatorContext.prototype._createReg32("eax", regBuffer, 0),
		ax: Asm86EmulatorContext.prototype._createReg16("ax", regBuffer, 0),
		al: Asm86EmulatorContext.prototype._createReg8("al", regBuffer, 0),
		ah: Asm86EmulatorContext.prototype._createReg8("ah", regBuffer, 1),
		ebx: Asm86EmulatorContext.prototype._createReg32("ebx", regBuffer, 4),
		bx: Asm86EmulatorContext.prototype._createReg16("bx", regBuffer, 4),
		bl: Asm86EmulatorContext.prototype._createReg8("bl", regBuffer, 4),
		bh: Asm86EmulatorContext.prototype._createReg8("bh", regBuffer, 5),
		ecx: Asm86EmulatorContext.prototype._createReg32("ecx", regBuffer, 8),
		cx: Asm86EmulatorContext.prototype._createReg16("cx", regBuffer, 8),
		cl: Asm86EmulatorContext.prototype._createReg8("cl", regBuffer, 8),
		ch: Asm86EmulatorContext.prototype._createReg8("ch", regBuffer, 9),
		edx: Asm86EmulatorContext.prototype._createReg32("edx", regBuffer, 12),
		dx: Asm86EmulatorContext.prototype._createReg16("dx", regBuffer, 12),
		dl: Asm86EmulatorContext.prototype._createReg8("dl", regBuffer, 12),
		dh: Asm86EmulatorContext.prototype._createReg8("dh", regBuffer, 13),
		esi: Asm86EmulatorContext.prototype._createReg32("esi", regBuffer, 16),
		si: Asm86EmulatorContext.prototype._createReg16("si", regBuffer, 16),
		edi: Asm86EmulatorContext.prototype._createReg32("edi", regBuffer, 20),
		di: Asm86EmulatorContext.prototype._createReg16("di", regBuffer, 20),
		esp: Asm86EmulatorContext.prototype._createReg32("esp", regBuffer, 24),
		sp: Asm86EmulatorContext.prototype._createReg16("sp", regBuffer, 24),
		ebp: Asm86EmulatorContext.prototype._createReg32("ebp", regBuffer, 28),
		bp: Asm86EmulatorContext.prototype._createReg16("bp", regBuffer, 28),
		eip: Asm86EmulatorContext.prototype._createReg32("eip", regBuffer, 32)
	};
	this.uint32Tmp = new Uint32Array(1);
	this.tmp4Byte = new DataView(new ArrayBuffer(4));
	this.currentInstruction = null;
	this.nextInstruction = this.memoryLimit;
	this.errorOccurred = false;
	this.instructions = [];
	this.instructionIndexFromAddress = function (address) {
		return (address - this.memoryLimit) >>> 2;
	};
	this.validateNextInstructionIndex = function () {
		var idx = (this.nextInstruction - this.memoryLimit) >>> 2;
		if (idx < 0 || idx >= this.instructions.length) {
			this.errorOccurred = true;
			errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_INSTRUCTION_ADDRESS + Asm86Emulator.prototype._hex(this.nextInstruction));
			return false;
		}
		return true;
	};
	this.gotoInterruptHandler = function (interruptNumber) {
		var addr = this.regs.esp.get(), v;
		if ((v = this.getMem(this.idt + (interruptNumber << 2), 4)) !== null) {
			if (this.setMem(addr - 4, this.getFlags(), 4)) {
				if (this.setMem(addr - 8, this.nextInstruction, 4)) {
					this.regs.esp.set(addr - 8);
					this.nextInstruction = v;
					return true;
				}
			}
		}
		return false;
	}
	this.step = function (stepping) {
		var old = this.nextInstruction, instr, addr, v;
		this.regs.eip.set(this.nextInstruction);
		if (this.flagI && this.pendingInterrupts.length) {
			//service the external interrupt request
			if (!this.gotoInterruptHandler(this.pendingInterrupts.pop())) return false;
			this.flagI = 0;
			old = this.nextInstruction;
			this.regs.eip.set(this.nextInstruction);
			if (stepping) return true;
		}
		if (this.validateNextInstructionIndex()) {
			instr = this.instructions[(this.nextInstruction - this.memoryLimit) >>> 2];
			this.nextInstruction += 4;
			this.currentInstruction = instr;
			if (instr.operator.isPrefix) {
				if (instr.operator.exec(this)) {
					//it is ok to run the next instruction
					if (this.validateNextInstructionIndex()) {
						instr = this.instructions[(this.nextInstruction - this.memoryLimit) >>> 2];
						instr.operator.exec(this, instr.op1, instr.op2);
					}
					this.nextInstruction = old; //go back to the "rep" prefix
				} else {
					//it is not ok to run the next instruction and it should be skipped
					this.nextInstruction += 4;
				}
			} else {
				instr.operator.exec(this, instr.op1, instr.op2);
			}
			//go back to the original instruction that caused the error
			if (this.errorOccurred) this.nextInstruction = old;
			this.currentInstruction = null;
			this.regs.eip.set(this.nextInstruction);
			return true;
		}
		return false;
	};
	this.resetExecution = function () {
		this.nextInstruction = this.memoryLimit;
		this.regs.eip.set(this.memoryLimit);
		this.errorOccurred = false;
		this.pendingIO = 0;
		this.pendingIOreg = null;
		this.pendingIOsize = 0;
		this.pendingInterrupts = [];
		this.currentInstruction = null;
		this.halted = false;
		this.dbgReq = false;
		return true;
	};
	this.resetMemory = function () {
		var i, mem = this.memory;
		if (this.memorySize >= 4) {
			for (i = this.memorySize - 4; i >= 0; i -= 4)
				mem.setUint32(i, 0);
		} else {
			for (i = this.memorySize - 1; i >= 0; i--)
				mem.setUint8(i, 0);
		}
		return true;
	};
	this.resetRegisters = function () {
		for (var i = (8 - 1) << 2; i >= 0; i -= 4)
			regBuffer.setUint32(i, 0);
		this.regs.esp.set(this.memoryLimit);
		this.flagCarry = 0;
		this.flagDir = 0;
		this.flagI = 0;
		this.flagOv = 0;
		this.flagSign = 0;
		this.flagZ = 0;
		this.idt = 0;
		return true;
	};
	this.getFlags = function () {
		return (this.flagCarry |
				(this.flagDir << 1) |
				(this.flagI << 2) |
				(this.flagOv << 3) |
				(this.flagSign << 4) |
				(this.flagZ << 5));
	};
	this.setFlags = function (flags) {
		this.flagCarry = (flags & 1);
		this.flagDir = ((flags >>> 1) & 1);
		this.flagI = ((flags >>> 2) & 1);
		this.flagOv = ((flags >>> 3) & 1);
		this.flagSign = ((flags >>> 4) & 1);
		this.flagZ = ((flags >>> 5) & 1);
		return true;
	};
	this.getMem = function (address, size) {
		if (address < 1024 || (address + size) > this.memoryLimit) {
			this.errorOccurred = true;
			errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_READ_ADDRESS + Asm86Emulator.prototype._hex(address));
			return null;
		}
		switch (size) {
			case 1:
				return this.memory.getUint8(address - 1024);
			case 2:
				return this.memory.getUint16(address - 1024, true);
			case 4:
				return this.memory.getUint32(address - 1024, true);
		}
		this.errorOccurred = true;
		errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_READ_SIZE + size.toString());
		return null;
	};
	this.setMem = function (address, value, size) {
		if (address < 1024 || (address + size) > this.memoryLimit) {
			this.errorOccurred = true;
			errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_WRITE_ADDRESS + Asm86Emulator.prototype._hex(address));
			return false;
		}
		switch (size) {
			case 1:
				this.memory.setUint8(address - 1024, value);
				return true;
			case 2:
				this.memory.setUint16(address - 1024, value, true);
				return true;
			case 4:
				this.memory.setUint32(address - 1024, value, true);
				return true;
		}
		this.errorOccurred = true;
		errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_WRITE_SIZE + size.toString());
		return false;
	};
	this.dbgGetByte = function (address) {
		if (address >= 1024 && (address + 1) <= this.memoryLimit) return this.memory.getUint8(address - 1024);
		return null;
	};
	this.dbgGetWord = function (address) {
		if (address >= 1024 && (address + 2) <= this.memoryLimit) return this.memory.getUint16(address - 1024, true);
		return null;
	};
	this.dbgGetDword = function (address) {
		if (address >= 1024 && (address + 4) <= this.memoryLimit) return this.memory.getUint32(address - 1024, true);
		return null;
	};
	this.dbgSetByte = function (address, value) {
		if (address >= 1024 && (address + 1) <= this.memoryLimit) {
			this.memory.setUint8(address - 1024, value);
			return true;
		}
		return false;
	};
	this.dbgSetWord = function (address, value) {
		if (address >= 1024 && (address + 2) <= this.memoryLimit) {
			this.memory.setUint16(address - 1024, value, true);
			return true;
		}
		return false;
	};
	this.dbgSetDword = function (address, value) {
		if (address >= 1024 && (address + 4) <= this.memoryLimit) {
			this.memory.setUint16(address - 1024, value, true);
			return true;
		}
		return false;
	};
	Object.freeze(this.regs);
	Object.seal(this);
}
Asm86EmulatorContext.prototype = {
	_createReg32: function (name, buffer, byteIndex) {
		var r = {
			get: function () { return buffer.getUint32(byteIndex, true); },
			set: function (x) { buffer.setUint32(byteIndex, x, true); return buffer.getUint32(byteIndex, true); },
			size: 4,
			name: name,
			type: Asm86Emulator.prototype.TYPE_REG
		};
		Object.freeze(r);
		return r;
	},
	_createReg16: function (name, buffer, byteIndex) {
		var r = {
			get: function () { return buffer.getUint16(byteIndex, true); },
			set: function (x) { buffer.setUint16(byteIndex, x, true); return buffer.getUint16(byteIndex, true); },
			size: 2,
			name: name,
			type: Asm86Emulator.prototype.TYPE_REG
		};
		Object.freeze(r);
		return r;
	},
	_createReg8: function (name, buffer, byteIndex) {
		var r = {
			get: function () { return buffer.getUint8(byteIndex); },
			set: function (x) { buffer.setUint8(byteIndex, x); return buffer.getUint8(byteIndex); },
			size: 1,
			name: name,
			type: Asm86Emulator.prototype.TYPE_REG
		};
		Object.freeze(r);
		return r;
	}
};
Object.freeze(Asm86EmulatorContext.prototype);
function Asm86Compiler(context, compilerErrorNotificationFunction) {
	this.parserContext = {
		context: context,
		code: "",
		vars: null,
		line: 0,
		lineStartIndex: 0,
		index: 0,
		labels: {},
		pendingLabelReferences: [],
		errorOccurred: false,
		compilerErrorNotificationFunction: compilerErrorNotificationFunction
	};
	this.compile = Asm86Compiler.prototype._compile;
	Object.seal(this.parserContext);
	Object.freeze(this);
}
Asm86Compiler.prototype = {
	//REG+REG*[2|4|8]+IMM
	TYPE_OPERAND: 0,
	TYPE_REGISTER: 1,
	TYPE_COMMA: 2,
	TYPE_OPENBRACKET: 3,
	TYPE_CLOSEBRACKET: 4,
	TYPE_ADD: 5,
	TYPE_MULTIPLY: 6,
	TYPE_COLON: 7,
	TYPE_NUMBER: 8,
	TYPE_IDENTIFIER: 9,
	TYPE_BYTE: 10,
	TYPE_WORD: 11,
	TYPE_DWORD: 12,
	TYPE_PTR: 13,
	_compile: function (code, vars) {
		var t, t2, parserContext = this.parserContext, pendingPrefix = null;
		parserContext.code = code;
		parserContext.line = 0;
		parserContext.lineStartIndex = 0;
		parserContext.vars = vars;
		parserContext.index = 0;
		parserContext.labels = {};
		parserContext.pendingLabelReferences = [];
		parserContext.errorOccurred = false;
		if (!Asm86Compiler.prototype._allocateVariables(parserContext)) return false;
		while (!parserContext.errorOccurred && (t = Asm86Compiler.prototype._getNextToken(parserContext))) {
			//higher level parsing (either labels or commands)
			if (t.type === Asm86Compiler.prototype.TYPE_IDENTIFIER) {
				if (pendingPrefix) {
					parserContext.errorOccurred = true;
					parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.OPERATOR_EXPECTED_AFTER_PREFIX, t.line, t.lineIndex, t.index);
				} else {
					if (parserContext.vars[t.lValue]) {
						parserContext.errorOccurred = true;
						parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.LABEL_OR_OPERATOR_EXPECTED, t.line, t.lineIndex, t.index);
					} else {
						//could be a new label...
						t2 = Asm86Compiler.prototype._getNextToken(parserContext);
						if (!t2 || t2.type !== Asm86Compiler.prototype.TYPE_COLON) {
							parserContext.errorOccurred = true;
							parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.COLON_EXPECTED, t.line, t.lineIndex, t.index);
						} else {
							//create the label
							Asm86Compiler.prototype._addLabel(parserContext, t.value, t.line, t.lineIndex, t.index);
						}
					}
				}
			} else if (t.type === Asm86Compiler.prototype.TYPE_OPERAND) {
				pendingPrefix = Asm86Compiler.prototype._parseOperator(parserContext, t, pendingPrefix);
			} else {
				parserContext.errorOccurred = true;
				parserContext.compilerErrorNotificationFunction(pendingPrefix ? Asm86Emulator.prototype.MESSAGES.OPERATOR_EXPECTED_AFTER_PREFIX : Asm86Emulator.prototype.MESSAGES.LABEL_OR_OPERATOR_EXPECTED, t.line, t.lineIndex, t.index);
			}
		}
		if (parserContext.errorOccurred) return false;
		return Asm86Compiler.prototype._resolvePendingLabelReferences(parserContext);
	},
	_parseMemorySum: function (parserContext, exprErr) {
		var t, op1 = Asm86Compiler.prototype._parseMemoryMul(parserContext, exprErr), op2;
		if (!op1) return null;
		t = Asm86Compiler.prototype._peekNextToken(parserContext);
		if (!t) {
			exprErr.err = (op1.lastToken || op1);
			exprErr.eof = true;
			return null;
		}
		if (t.type === Asm86Compiler.prototype.TYPE_CLOSEBRACKET) return op1;
		Asm86Compiler.prototype._getNextToken(parserContext);
		if (t.type !== Asm86Compiler.prototype.TYPE_ADD) {
			exprErr.err = t;
			return null;
		}
		op2 = Asm86Compiler.prototype._parseMemorySum(parserContext, exprErr);
		if (!op2) return null;
		switch (op2.type) {
			case Asm86Compiler.prototype.TYPE_ADD:
				switch (op1.type) {
					case Asm86Compiler.prototype.TYPE_NUMBER:
						if (op2.imm) {
							parserContext.context.uint32Tmp[0] = op1.value + op2.imm.value;
							op2.imm.value = parserContext.context.uint32Tmp[0];
						} else {
							op2.imm = op1;
						}
						break;
					case Asm86Compiler.prototype.TYPE_REGISTER:
						if (op2.regScale && op2.reg) {
							exprErr.err = op2.lastToken;
							return null;
						}
						if (op2.reg)
							op2.regScale = op1;
						else
							op2.reg = op1;
						break;
					default: //Asm86Compiler.prototype.TYPE_MULTIPLY
						if (op2.regScale) {
							exprErr.err = op2.lastToken;
							return null;
						}
						op2.regScale = op1.regScale;
						op2.scale = op1.scale;
						break;
				}
				return op2;
			case Asm86Compiler.prototype.TYPE_MULTIPLY:
				switch (op1.type) {
					case Asm86Compiler.prototype.TYPE_NUMBER:
						op2.imm = op1;
						op2.type = Asm86Compiler.prototype.TYPE_ADD;
						break;
					case Asm86Compiler.prototype.TYPE_REGISTER:
						op2.reg = op1;
						op2.type = Asm86Compiler.prototype.TYPE_ADD;
						break;
					default: //Asm86Compiler.prototype.TYPE_MULTIPLY
						exprErr.err = op2.lastToken;
						return null;
				}
				return op2;
			case Asm86Compiler.prototype.TYPE_REGISTER:
				switch (op1.type) {
					case Asm86Compiler.prototype.TYPE_NUMBER:
						return { reg: op2, imm: op1, lastToken: op2, type: Asm86Compiler.prototype.TYPE_ADD };
					case Asm86Compiler.prototype.TYPE_REGISTER:
						return { reg: op2, regScale: op1, lastToken: op2, type: Asm86Compiler.prototype.TYPE_ADD };
				}
				//Asm86Compiler.prototype.TYPE_MULTIPLY
				op1.lastToken = op2;
				op1.reg = op2;
				op1.type = Asm86Compiler.prototype.TYPE_ADD;
				return op1;
		}
		//Asm86Compiler.prototype.TYPE_NUMBER
		switch (op1.type) {
			case Asm86Compiler.prototype.TYPE_NUMBER:
				parserContext.context.uint32Tmp[0] = op1.value + op2.value;
				op2.value = parserContext.context.uint32Tmp[0];
				return op2;
			case Asm86Compiler.prototype.TYPE_REGISTER:
				return { reg: op1, imm: op2, lastToken: op2, type: Asm86Compiler.prototype.TYPE_ADD };
		}
		//Asm86Compiler.prototype.TYPE_MULTIPLY
		op1.imm = op2;
		op1.lastToken = op2;
		op1.type = Asm86Compiler.prototype.TYPE_ADD;
		return op1;
	},
	_parseMemoryMul: function (parserContext, exprErr) {
		var t, op1 = Asm86Compiler.prototype._parseMemoryFactor(parserContext, exprErr), op2;
		if (!op1) return null;
		t = Asm86Compiler.prototype._peekNextToken(parserContext);
		if (!t) {
			exprErr.err = op1;
			exprErr.eof = true;
			return null;
		}
		if (t.type === Asm86Compiler.prototype.TYPE_ADD || t.type === Asm86Compiler.prototype.TYPE_CLOSEBRACKET) return op1;
		Asm86Compiler.prototype._getNextToken(parserContext);
		if (t.type !== Asm86Compiler.prototype.TYPE_MULTIPLY) {
			exprErr.err = t;
			return null;
		}
		op2 = Asm86Compiler.prototype._parseMemoryMul(parserContext, exprErr);
		if (!op2) return null;
		if (op1.type === Asm86Compiler.prototype.TYPE_REGISTER && op2.type === Asm86Compiler.prototype.TYPE_REGISTER) {
			exprErr.err = op2;
			return null;
		}
		if (op1.type === Asm86Compiler.prototype.TYPE_NUMBER && op2.type === Asm86Compiler.prototype.TYPE_NUMBER) {
			parserContext.context.uint32Tmp[0] = op1.value * op2.value;
			op2.value = parserContext.context.uint32Tmp[0];
			return op2;
		}
		if (op2.type === Asm86Compiler.prototype.TYPE_MULTIPLY) {
			if (op1.type === Asm86Compiler.prototype.TYPE_REGISTER) {
				exprErr.err = op2.regScale;
				return null;
			}
			parserContext.context.uint32Tmp[0] = op1.value * op2.scale.value;
			op2.scale.value = parserContext.context.uint32Tmp[0];
			return op2;
		}
		return ((op1.type === Asm86Compiler.prototype.TYPE_NUMBER) ?
			{ scale: op1, regScale: op2, lastToken: op2, type: Asm86Compiler.prototype.TYPE_MULTIPLY } :
			{ scale: op2, regScale: op1, lastToken: op2, type: Asm86Compiler.prototype.TYPE_MULTIPLY });
	},
	_parseMemoryFactor: function (parserContext, exprErr) {
		var v, t = Asm86Compiler.prototype._getNextToken(parserContext);
		if (!t) {
			exprErr.eof = true;
			return null;
		}
		if (t.type === Asm86Compiler.prototype.TYPE_NUMBER ||
			t.type === Asm86Compiler.prototype.TYPE_REGISTER) return t;
		if (t.type === Asm86Compiler.prototype.TYPE_IDENTIFIER) {
			if ((v = parserContext.vars[t.lValue]) !== null) {
				//change the token from identifier to number (the variable's address)
				t.type = Asm86Compiler.prototype.TYPE_NUMBER;
				t.value = v.address;
				return t;
			}
		}
		exprErr.err = t;
		return null;
	},
	_parseMemoryOperand: function (parserContext, initialToken) {
		var t, size = 0, exprErr = { err: null, eof: false }, r, scale, regScale = null, imm = null, reg = null;
		switch (initialToken.type) {
			case Asm86Compiler.prototype.TYPE_DWORD:
				size = 4;
				t = Asm86Compiler.prototype._getNextToken(parserContext);
				break;
			case Asm86Compiler.prototype.TYPE_WORD:
				size = 2;
				t = Asm86Compiler.prototype._getNextToken(parserContext);
				break;
			case Asm86Compiler.prototype.TYPE_BYTE:
				size = 1;
				t = Asm86Compiler.prototype._getNextToken(parserContext);
				break;
		}
		if (size) {
			if (!t || t.type !== Asm86Compiler.prototype.TYPE_PTR) {
				parserContext.errorOccurred = true;
				if (t)
					parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.PTR_EXPECTED, t.line, t.lineIndex, t.index);
				else
					parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.PTR_EXPECTED, initialToken.line, initialToken.lineIndex, initialToken.index);
				return null;
			}
			t = Asm86Compiler.prototype._getNextToken(parserContext);
			if (!t || t.type !== Asm86Compiler.prototype.TYPE_OPENBRACKET) {
				parserContext.errorOccurred = true;
				if (t)
					parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.SQBRACKET_EXPECTED, t.line, t.lineIndex, t.index);
				else
					parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.SQBRACKET_EXPECTED, initialToken.line, initialToken.lineIndex, initialToken.index);
				return null;
			}
		}
		r = Asm86Compiler.prototype._parseMemorySum(parserContext, exprErr);
		t = Asm86Compiler.prototype._getNextToken(parserContext);
		if (!t || exprErr.eof) {
			parserContext.errorOccurred = true;
			if (t)
				parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_MEMORY_REF_FORMAT, t.line, t.lineIndex, t.index);
			else
				parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_MEMORY_REF_FORMAT, initialToken.line, initialToken.lineIndex, initialToken.index);
			return null;
		}
		if (exprErr.err) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_MEMORY_REF_FORMAT, exprErr.err.line, exprErr.err.lineIndex, exprErr.err.index);
			return null;
		}
		if (t.type !== Asm86Compiler.prototype.TYPE_CLOSEBRACKET) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_MEMORY_REF_FORMAT, t.line, t.lineIndex, t.index);
			return null;
		}
		scale = (r.scale ? r.scale.value : 1);
		if (scale === 1) {
			scale = 0;
		} else if (scale === 2) {
			scale = 1;
		} else if (scale === 4) {
			scale = 2;
		} else if (scale === 8) {
			scale = 3;
		} else {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_SCALE, r.scale.line, r.scale.lineIndex, r.scale.index);
			return null;
		}
		if (r.type === Asm86Compiler.prototype.TYPE_NUMBER) {
			imm = r.value;
		} else if (r.type === Asm86Compiler.prototype.TYPE_REGISTER) {
			reg = r.value;
		} else {
			if (r.imm && r.imm.value)
				imm = r.imm.value;
			if (r.reg)
				reg = r.reg.value;
			if (r.regScale)
				regScale = r.regScale.value;
		}
		return Asm86Compiler.prototype._createMemoryAccess(parserContext.context, size, reg, regScale, scale, imm);
	},
	_parseOperand: function (parserContext, line, lineIndex, index) {
		var t = Asm86Compiler.prototype._getNextToken(parserContext), v;
		if (t) {
			switch (t.type) {
				case Asm86Compiler.prototype.TYPE_BYTE:
				case Asm86Compiler.prototype.TYPE_WORD:
				case Asm86Compiler.prototype.TYPE_DWORD:
				case Asm86Compiler.prototype.TYPE_OPENBRACKET:
					return Asm86Compiler.prototype._parseMemoryOperand(parserContext, t);
				case Asm86Compiler.prototype.TYPE_NUMBER:
					return Asm86Compiler.prototype._createImmediate(t.value);
				case Asm86Compiler.prototype.TYPE_REGISTER:
					return t.value;
				case Asm86Compiler.prototype.TYPE_IDENTIFIER:
					//could be a variable or a label reference
					v = parserContext.vars[t.lValue];
					if (!v) {
						v = parserContext.labels[t.lValue];
						if (v) {
							v = Asm86Compiler.prototype._createLabelReference(v);
						} else {
							v = Asm86Compiler.prototype._createPendingLabelReference(t.lValue, t.line, t.lineIndex, t.index);
							parserContext.pendingLabelReferences.push(v);
						}
					}
					return v;
			}
		}
		if (!parserContext.errorOccurred) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.OPERAND_EXPECTED, line, lineIndex, index);
		}
		return null;
	},
	_parseOperator: function (parserContext, operatorToken, pendingPrefix) {
		if (operatorToken.value.isPrefix) {
			if (pendingPrefix) {
				parserContext.errorOccurred = true;
				parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.OPERATOR_EXPECTED_AFTER_PREFIX, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
				return null;
			}
			return (Asm86Compiler.prototype._addInstruction(parserContext, operatorToken.value, undefined, undefined, operatorToken.line, operatorToken.lineIndex, operatorToken.index) ? operatorToken.value : null);
		}
		if (pendingPrefix && !operatorToken.value.acceptsPrefix) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.OPERATOR_CANNOT_HAVE_PREFIX, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
			return null;
		}
		var count = operatorToken.value.operandCount, op1, op2;
		if (!count) {
			Asm86Compiler.prototype._addInstruction(parserContext, operatorToken.value, undefined, undefined, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
			return null;
		}
		//the only exception... ret has an optional argument
		if (operatorToken.value === Asm86Emulator.prototype.OP.ret) {
			op1 = Asm86Compiler.prototype._peekNextToken(parserContext);
			if (op1 && op1.type === Asm86Compiler.prototype.TYPE_NUMBER) {
				Asm86Compiler.prototype._getNextToken(parserContext);
				op1 = Asm86Compiler.prototype._createImmediate(op1.value);
			} else {
				op1 = undefined;
			}
		} else {
			if (count >= 1) op1 = Asm86Compiler.prototype._parseOperand(parserContext, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
			if (!op1) return null;
		}
		if (count === 1) {
			Asm86Compiler.prototype._addInstruction(parserContext, operatorToken.value, op1, undefined, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
			return null;
		}
		op2 = Asm86Compiler.prototype._getNextToken(parserContext);
		if (!op2 || op2.type !== Asm86Compiler.prototype.TYPE_COMMA) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.COMMA_EXPECTED, op2.line, op2.lineIndex, op2.index);
			return null;
		}
		op2 = Asm86Compiler.prototype._parseOperand(parserContext, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
		if (op2) Asm86Compiler.prototype._addInstruction(parserContext, operatorToken.value, op1, op2, operatorToken.line, operatorToken.lineIndex, operatorToken.index);
		return null;
	},
	_resolvePendingLabelReferences: function (parserContext) {
		var i, p, label, pendingLabelReferences = parserContext.pendingLabelReferences, labels = parserContext.labels;
		for (i = 0; i < pendingLabelReferences.length; i++) {
			p = pendingLabelReferences[i];
			label = labels[p.label];
			if (!label) {
				parserContext.errorOccurred = true;
				parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.UNKNOWN_LABEL + "\"" + p.label + "\"", p.line, p.lineIndex, p.index);
				return false;
			}
			p.label = label;
			delete p.line;
			delete p.lineIndex;
			delete p.index;
			Object.freeze(p);
		}
		parserContext.pendingLabelReferences = [];
		return true;
	},
	_allocateVariablesSorter: function (a, b) {
		if (a.size === b.size) return a.name.localeCompare(b.name);
		if ((a.size & 3) || (b.size & 3)) {
			if (a.size === 4) return -1;
			if (b.size === 4) return 1;
			if (!(a.size & 3)) return -1;
			if (!(b.size & 3)) return 1;
			if (a.size === 2) return -1;
			if (b.size === 2) return 1;
			if (!(a.size & 1)) return -1;
			if (!(b.size & 1)) return 1;
		}
		return a.size - b.size;
	},
	_allocateVariables: function (parserContext) {
		var totalSize = 0, name, i, addr = 1024, v, varArray = [], vars = parserContext.vars;
		for (name in vars) {
			v = vars[name];
			totalSize += v.size;
			varArray.push(v);
		}
		if (totalSize > parserContext.context.memorySize) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.NOT_ENOUGH_SPACE + totalSize + " bytes", -1, -1, -1);
			return false;
		}
		varArray.sort(Asm86Compiler.prototype._allocateVariablesSorter);
		for (i = 0; i < varArray.length; i++) {
			v = varArray[i];
			v.address = addr;
			addr += v.size;
		}
		return true;
	},
	_addInstruction: function (parserContext, operator, op1, op2, line, lineIndex, index) {
		var r;
		if (!operator.isPrefix) {
			r = operator.validate(op1, op2);
			if (r) {
				parserContext.errorOccurred = true;
				parserContext.compilerErrorNotificationFunction(r, line, lineIndex, index);
				return null;
			}
		}
		r = {
			operator: operator,
			op1: op1,
			op2: op2,
			line: line,
			lineIndex: lineIndex,
			index: index
		};
		Object.freeze(r);
		parserContext.context.instructions.push(r);
		return r;
	},
	_addLabel: function (parserContext, name, line, lineIndex, index) {
		var lName = name.toLocaleLowerCase(), label;
		if (parserContext.labels[lName]) {
			parserContext.errorOccurred = true;
			parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DUPLICATE_LABEL + "\"" + name + "\"", line, lineIndex, index);
			return null;
		}
		label = {
			name: name,
			instructionIndex: (parserContext.context.memoryLimit + (parserContext.context.instructions.length << 2))
		};
		Object.freeze(label);
		parserContext.labels[lName] = label;
		return label;
	},
	_createMemoryAccess: function (ctx, size, reg, regScale, scale, imm) {
		var m = {
			get: function () { return ctx.getMem(this.getAddress(), this.size); },
			set: function (x) { return ctx.setMem(this.getAddress(), x, this.size); },
			size: size,
			changeSize: function (newSize) { this.size = newSize; Object.freeze(this); },
			type: Asm86Emulator.prototype.TYPE_MEM
		};
		if (imm !== undefined && imm !== null) {
			if (regScale)
				m.getAddress = (reg ? (function () { return (reg.get() + (regScale.get() << scale) + imm); }) : (function () { return ((regScale.get() << scale) + imm); }));
			else
				m.getAddress = (reg ? (function () { return (reg.get() + imm); }) : (function () { return imm; }));
		} else if (regScale) {
			m.getAddress = (reg ? (function () { return (reg.get() + (regScale.get() << scale)); }) : (function () { return (regScale.get() << scale); }));
		} else {
			m.getAddress = function () { return reg.get(); };
		}
		if (size) Object.freeze(m); else Object.seal(m);
		return m;
	},
	_createImmediate: function (value) {
		//do not freeze!
		var i = {
			get: function () { return value; },
			size: 0,
			changeSize: function (newSize) { this.size = newSize; Object.freeze(this); },
			type: Asm86Emulator.prototype.TYPE_IMM
		};
		Object.seal(i);
		return i;
	},
	_createLabelReference: function (label) {
		var r = {
			label: label,
			get: function () { return this.label.instructionIndex; },
			size: 4,
			type: Asm86Emulator.prototype.TYPE_LABELREF
		};
		Object.freeze(r);
		return r;
	},
	_createPendingLabelReference: function (name, line, lineIndex, index) {
		return {
			label: name,
			get: function () { return this.label.instructionIndex; },
			line: line,
			lineIndex: lineIndex,
			index: index,
			size: 4,
			type: Asm86Emulator.prototype.TYPE_LABELREF
		};
	},
	_createToken: function (parserContext, currentToken, startIndex, nextIndex) {
		var lToken, i, c, validLength, t = { line: parserContext.line, lineIndex: (startIndex - parserContext.lineStartIndex), index: startIndex }, neg = false, radix = 10, start;
		parserContext.index = nextIndex;
		switch ((c = currentToken.charCodeAt(0))) {
			case 0x002A: //*
				t.type = Asm86Compiler.prototype.TYPE_MULTIPLY;
				break;
			case 0x002B: //+
				t.type = Asm86Compiler.prototype.TYPE_ADD;
				break;
			case 0x002C: //,
				t.type = Asm86Compiler.prototype.TYPE_COMMA;
				break;
			case 0x003A: //:
				t.type = Asm86Compiler.prototype.TYPE_COLON;
				break;
			case 0x005B: //[
				t.type = Asm86Compiler.prototype.TYPE_OPENBRACKET;
				break;
			case 0x005D: //]
				t.type = Asm86Compiler.prototype.TYPE_CLOSEBRACKET;
				break;
			default:
				lToken = currentToken.toLocaleLowerCase();
				if (c <= 0x0039) {
					t.type = Asm86Compiler.prototype.TYPE_NUMBER;
					i = 0;
					if (c === 0x002D) {
						neg = true;
						i++;
					}
					validLength = lToken.length;
					if (validLength >= (i + 2)) {
						if (lToken.charCodeAt(i) === 0x0030) {
							if (lToken.charCodeAt(i + 1) === 0x0078) { //x
								radix = 16;
								i += 2;
							} else if (lToken.charCodeAt(i + 1) === 0x0062) { //b
								radix = 2;
								i += 2;
							}
						}
						if (radix === 10) {
							switch (lToken.charCodeAt(validLength - 1)) {
								case 0x0062: //b
									validLength--;
									if (radix !== 10) {
										parserContext.errorOccurred = true;
										parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_NUMBER, t.line, t.lineIndex, t.index);
										return null;
									}
									radix = 2;
									break;
								case 0x0068: //h
									validLength--;
									if (radix !== 10) {
										parserContext.errorOccurred = true;
										parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_NUMBER, t.line, t.lineIndex, t.index);
										return null;
									}
									radix = 16;
									break;
							}
						}
					}
					if (i >= validLength) {
						parserContext.errorOccurred = true;
						parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_NUMBER, t.line, t.lineIndex, t.index);
						return null;
					}
					start = i;
					for (; i < validLength; i++) {
						c = lToken.charCodeAt(i);
						switch (radix) {
							case 2:
								parserContext.errorOccurred = (c < 0x0030 || c > 0x0031);
								break;
							case 10:
								parserContext.errorOccurred = (c < 0x0030 || c > 0x0039);
								break;
							case 16:
								parserContext.errorOccurred = ((c < 0x0030 || c > 0x0039) && (c < 0x0061 || c > 0x0066));
								break;
						}
						if (parserContext.errorOccurred) {
							parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_NUMBER, t.line, t.lineIndex, t.index);
							return null;
						}
					}
					c = parseInt(lToken.substring(start), radix);
					if (neg) c = -c;
					if (c < -0x80000000 || c > 0xFFFFFFFF) {
						parserContext.errorOccurred = true;
						parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.VALUE_OUT_OF_RANGE, t.line, t.lineIndex, t.index);
						return null;
					}
					parserContext.context.uint32Tmp[0] = c;
					t.value = parserContext.context.uint32Tmp[0];
				} else {
					if (lToken === "byte") {
						t.type = Asm86Compiler.prototype.TYPE_BYTE;
					} else if (lToken === "word") {
						t.type = Asm86Compiler.prototype.TYPE_WORD;
					} else if (lToken === "dword") {
						t.type = Asm86Compiler.prototype.TYPE_DWORD;
					} else if (lToken === "ptr") {
						t.type = Asm86Compiler.prototype.TYPE_PTR;
					} else if (lToken === "in") {
						t.type = Asm86Compiler.prototype.TYPE_OPERAND;
						t.value = Asm86Emulator.prototype.OP._in;
					} else {
						c = parserContext.context.regs[lToken];
						if (c) {
							t.type = Asm86Compiler.prototype.TYPE_REGISTER;
							t.value = c;
						} else {
							c = Asm86Emulator.prototype.OP[lToken];
							if (c) {
								t.type = Asm86Compiler.prototype.TYPE_OPERAND;
								t.value = c;
							} else {
								t.type = Asm86Compiler.prototype.TYPE_IDENTIFIER;
								t.value = currentToken;
								t.lValue = lToken;
							}
						}
					}
				}
				break;
		}
		Object.seal(t);
		return t;
	},
	_peekNextToken: function (parserContext) {
		var t = Asm86Compiler.prototype._getNextToken(parserContext);
		if (t) parserContext.index = t.index;
		return t;
	},
	_getNextToken: function (parserContext) {
		var i, c, t, code = parserContext.code, insideComment = false, currentToken = "", startIndex = -1, negativeNumber = false;
		for (i = parserContext.index; i < code.length; i++) {
			switch ((c = code.charCodeAt(i))) {
				case 0x0020:
				case 0x0009:
				case 0x000B:
				case 0x000C:
				case 0x00A0: //OGHAM SPACE MARK (U+1680), MONGOLIAN VOWEL SEPARATOR (U+180E), EN QUAD (U+2000), EM QUAD (U+2001), EN SPACE (U+2002), EM SPACE (U+2003), THREE-PER-EM SPACE (U+2004), FOUR-PER-EM SPACE (U+2005), SIX-PER-EM SPACE (U+2006), FIGURE SPACE (U+2007), PUNCTUATION SPACE (U+2008), THIN SPACE (U+2009), HAIR SPACE (U+200A), NARROW NO-BREAK SPACE (U+202F), MEDIUM MATHEMATICAL SPACE (U+205F), IDEOGRAPHIC SPACE (U+3000)
					//white space
					if (startIndex >= 0) return Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i + 1);
					break;
				case 0x000A:
					//new line
					if ((i + 1) < code.length && code.charCodeAt(i + 1) === 0x000D)
						i++;
					insideComment = false;
					if (startIndex >= 0) t = Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i + 1);
					parserContext.line++;
					parserContext.lineStartIndex = i + 1;
					if (startIndex >= 0) return t;
					break;
				case 0x000D:
					//new line
					if ((i + 1) < code.length && code.charCodeAt(i + 1) === 0x000A)
						i++;
					insideComment = false;
					if (startIndex >= 0) t = Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i + 1);
					parserContext.line++;
					parserContext.lineStartIndex = i + 1;
					if (startIndex >= 0) return t;
					break;
				case 0x0085:
				case 0x2028:
				case 0x2029:
					//new line
					insideComment = false;
					if (startIndex >= 0) t = Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i + 1);
					parserContext.line++;
					parserContext.lineStartIndex = i + 1;
					if (startIndex >= 0) return t;
					break;
				case 0x002A: //*
				case 0x002B: //+
				case 0x002C: //,
				case 0x003A: //:
				case 0x005B: //[
				case 0x005D: //]
					if (insideComment) break;
					if (startIndex >= 0) return Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i);
					return Asm86Compiler.prototype._createToken(parserContext, code.charAt(i), i, i + 1);
				case 0x003B: //;
					if (startIndex >= 0) return Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i);
					insideComment = true;
					break;
				default:
					if (insideComment) break;
					if (c === 0x002D && startIndex < 0) { //-
						currentToken = "-";
						startIndex = i;
					} else {
						if (c !== 0x005F && (c < 0x0030 || (c > 0x0039 && c < 0x0041) || (c > 0x005A && c < 0x0061) || (c > 0x007A && c < 0x00C0))) {
							parserContext.errorOccurred = true;
							parserContext.compilerErrorNotificationFunction(Asm86Emulator.prototype.MESSAGES.INVALID_CHAR + "\"" + String.fromCharCode(c) + "\"", parserContext.line, i - parserContext.lineStartIndex, i);
							return null;
						}
						if (startIndex < 0) {
							currentToken = code.charAt(i);
							startIndex = i;
						} else {
							currentToken += code.charAt(i);
						}
					}
					break;
			}
		}
		if (currentToken.length) return Asm86Compiler.prototype._createToken(parserContext, currentToken, startIndex, i);
		return null;
	}
};
Object.freeze(Asm86Compiler.prototype);
//inputFunction = function(address, ioArray, size) return true if operation succeeded, or false indicate that the operation is still pending
//outputFunction = function(address, ioArray, size) return true if operation succeeded, or false indicate that the operation is still pending
function Asm86Emulator(memorySize, inputFunction, outputFunction) {
	if (!Date.now) Date.now = function () { return (+new Date()); };
	var emulator = this, vars = {}, continueOnResumption = false, running = false, compiled = false, stepPending = false, portMem = new DataView(new ArrayBuffer(16)), execTimeout = null, lastTimeout = null, lastTimeout2 = null, lastTimeout3 = null, lastTimeout4 = null;
	function ObserverSet() {
		this._observers = new Array();
		Object.freeze(this);
	}
	ObserverSet.prototype = {
		attach: function (targetFunction, target) {
			this._observers.push(targetFunction);
			this._observers.push(isEmpty(target) ? null : target);
			return true;
		},
		detach: function (target) {
			var i, observers = this._observers,
			tot = observers.length;
			for (i = 0; i < tot; i += 2) {
				if (observers[i + 1] === target) {
					observers.splice(i, 2);
					return true;
				}
			}
			return false;
		},
		detachFunction: function (targetFunction) {
			var i, observers = this._observers,
			tot = observers.length;
			for (i = 0; i < tot; i += 2) {
				if (observers[i] === targetFunction) {
					observers.splice(i, 2);
					return true;
				}
			}
			return false;
		},
		notify: function () {
			var i, observers = this._observers,
			tot = observers.length;
			for (i = 0; i < tot; i += 2) {
				observers[i].apply(observers[i + 1], arguments);
			}
			return true;
		}
	};
	Object.freeze(ObserverSet.prototype);
	//ports
	//0 1 2 3 (LO ... HI) = current time in ms (RO) (reading port 0 updates ports 0, 1, 2 and 3)
	//4 5 6 7 (LO ... HI) = timer interval in ms (RW)
	//8 9 10 11 = timer enabled (writing a value != 0 either enables the timer or resets it if it was already enabled, there are four timers, each port controls one of them) (RW)
	//255 = system shutdown (write a value != 0 to shutdown the system) (WO)
	function timeoutHandler() {
		portMem.setUint8(8, 0);
		if (lastTimeout) {
			lastTimeout = null;
			emulator.externalInterruptRequest(0x20);
		}
		return true;
	}
	function timeoutHandler2() {
		portMem.setUint8(9, 0);
		if (lastTimeout2) {
			lastTimeout2 = null;
			emulator.externalInterruptRequest(0x21);
		}
		return true;
	}
	function timeoutHandler3() {
		portMem.setUint8(10, 0);
		if (lastTimeout3) {
			lastTimeout3 = null;
			emulator.externalInterruptRequest(0x22);
		}
		return true;
	}
	function timeoutHandler4() {
		portMem.setUint8(11, 0);
		if (lastTimeout4) {
			lastTimeout4 = null;
			emulator.externalInterruptRequest(0x23);
		}
		return true;
	}
	this.defaultInput = function (address, ioArray, size) {
		if (address >= 0 && address <= 0xFFFF) {
			var v;
			if (!address) {
				v = Date.now();
				portMem.setUint32(0, v, true);
				ioArray.setUint32(0, v, true);
				return true;
			} else if (address <= 11) {
				ioArray.setUint32(0, portMem.getUint32(address, true), true);
				return true;
			}
		}
		ioArray.setUint32(0, 0);
		return true;
	};
	this.defaultOutput = function (address, ioArray, size) {
		var v, t, end = address + size;
		if (address >= 0 && address <= 0xFFFF) {
			if (address <= 11) {
				for (t = 0, v = address; t < size; t++, v++) {
					if (v > 3 && v <= 11)
						portMem.setUint8(v, ioArray.getUint8(t));
				}
			}
			t = portMem.getUint32(4, true);
			if (address <= 8 && end > 8) {
				v = portMem.getUint8(8);
				portMem.setUint8(8, (v && t) ? 1 : 0, true);
				if (lastTimeout) {
					window.clearTimeout(lastTimeout);
					lastTimeout = null;
				}
				if (v && t)
					lastTimeout = setTimeout(timeoutHandler, t);
			}
			if (address <= 9 && end > 9) {
				v = portMem.getUint8(9);
				portMem.setUint8(9, (v && t) ? 1 : 0, true);
				if (lastTimeout2) {
					window.clearTimeout(lastTimeout2);
					lastTimeout2 = null;
				}
				if (v && t)
					lastTimeout2 = setTimeout(timeoutHandler2, t);
			}
			if (address <= 10 && end > 10) {
				v = portMem.getUint8(10);
				portMem.setUint8(10, (v && t) ? 1 : 0, true);
				if (lastTimeout3) {
					window.clearTimeout(lastTimeout3);
					lastTimeout3 = null;
				}
				if (v && t)
					lastTimeout3 = setTimeout(timeoutHandler3, t);
			}
			if (address <= 11 && end > 11) {
				v = portMem.getUint8(11);
				portMem.setUint8(11, (v && t) ? 1 : 0, true);
				if (lastTimeout4) {
					window.clearTimeout(lastTimeout4);
					lastTimeout4 = null;
				}
				if (v && t)
					lastTimeout4 = setTimeout(timeoutHandler4, t);
			}
			if (address <= 255 && end > 255) {
				if (ioArray.getUint8(255 - address)) {
					this.reset();
					//this.context.nextInstruction = this.context.memoryLimit;
					//running = false;
				}
			}
		}
		return true;
	};
	this.context = Asm86Emulator.prototype._createContext(this, memorySize, inputFunction || this.defaultInput, outputFunction || this.defaultOutput);
	this.onCompilationFinished = new ObserverSet(); //emulator, errorOccurred
	this.onCompilationError = new ObserverSet(); //emulator, message, line, lineIndex, index (line, lineIndex and index are 0 based)
	this.onReset = new ObserverSet(); //emulator
	this.onRuntimeError = new ObserverSet(); //emulator, message
	this.onStartedRunning = new ObserverSet(); //emulator
	this.onStepFinished = new ObserverSet(); //emulator, reset, halted, pendingIO, errorOccurred
	this.onStoppedRunning = new ObserverSet(); //emulator, reset, stopCalled, halted, pendingIO, errorOccurred
	this.onVariableAdded = new ObserverSet(); //emulator, newVar
	this.onVariableError = new ObserverSet(); //emulator, message
	this.onVariableRemoved = new ObserverSet(); //emulator, oldVar
	this.isRunning = function () { return running; };
	this.isHalted = function () { return this.context.halted; };
	this.isPendingIO = function () { return !!this.context.pendingIO; };
	this.isRunningOrWaiting = function () { return (running || this.context.halted || !!this.context.pendingIO); }
	this.isCompiled = function () { return compiled; };
	this.willContinueAfterResumption = function () { return continueOnResumption; };
	this.memorySize = this.context.memorySize;
	this.registers = this.context.regs;
	this.getFlagCarry = function () { return this.context.flagCarry; }
	this.getFlagDir = function () { return this.context.flagDir; }
	this.getFlagI = function () { return this.context.flagI; }
	this.getFlagOv = function () { return this.context.flagOv; }
	this.getFlagSign = function () { return this.context.flagSign; }
	this.getFlagZ = function () { return this.context.flagZ; }
	this.getInstructionAtAddress = function (address) {
		var idx = this.context.instructionIndexFromAddress(address);
		if (idx < 0 || idx >= this.context.instructions.length) return null;
		return this.context.instructions[idx];
	};
	this.numericString = Asm86Emulator.prototype._numeric;
	this.hexString = Asm86Emulator.prototype._hex;
	this.hexStringNoPrefix = Asm86Emulator.prototype._hexNoPrefix;
	function internalResumeTimer() {
		return ((running && !emulator.context.halted && !emulator.context.pendingIO) ? internalRun.call(emulator) : true);
	}
	function internalRun() {
		var ctx = this.context, firstTime = running, count = 0;
		running = true;
		stepPending = false;
		continueOnResumption = false;
		ctx.errorOccurred = false;
		if (!firstTime) this.onStartedRunning.notify(this);
		firstTime = Date.now();
		while (running && !ctx.errorOccurred && !ctx.halted && !ctx.pendingIO) {
			if ((++count) > 100) {
				count = 0;
				if ((Date.now() - firstTime) > 5) {
					execTimeout = setTimeout(internalResumeTimer, 5);
					return true;
				}
			}
			ctx.step();
		}
		if (ctx.dbgReq) {
			ctx.halted = false;
			ctx.dbgReq = false;
		}
		running = false;
		stepPending = false;
		continueOnResumption = ((ctx.halted || !!ctx.pendingIO) && !ctx.errorOccurred);
		this.onStoppedRunning.notify(this, false, false, ctx.halted, !!ctx.pendingIO, ctx.errorOccurred);
		return true;
	}
	this.stop = function () {
		var ctx = this.context;
		if (!compiled || ctx.halted || ctx.pendingIO) return false;
		if (running) {
			running = false;
			stepPending = false;
			continueOnResumption = false;
			this.onStoppedRunning.notify(this, false, true, ctx.halted, !!ctx.pendingIO, ctx.errorOccurred);
		}
		return true;
	}
	this.reset = function () {
		var wasRunningOrWaiting = this.isRunningOrWaiting(), wasStep = stepPending;
		running = false;
		stepPending = false;
		continueOnResumption = false;
		if (execTimeout) {
			clearTimeout(execTimeout);
			execTimeout = null;
		}
		this.context.resetExecution();
		this.context.resetMemory();
		Asm86Emulator.prototype._fillVariables(this.context, vars);
		this.context.resetRegisters();
		if (wasRunningOrWaiting) {
			if (wasStep)
				this.onStepFinished.notify(this, true, false, false, false);
			else
				this.onStoppedRunning.notify(this, true, false, false, false, false);
		}
		this.onReset.notify(this);
		portMem.setUint32(0, Date.now(), true);
		portMem.setUint32(4, 100, true);
		portMem.setUint32(8, 0, true);
		return wasRunningOrWaiting;
	};
	function externalInterruptSorter(a, b) {
		//interrupts with lower numbers have higher priority (should appear last within pendingInterrupts vector)
		return b - a;
	}
	this.externalInterruptRequest = function (interruptNumber) {
		if (interruptNumber < 32 || interruptNumber > 255) return false;
		var ctx = this.context, i, skip = false;
		for (i = 0; i < ctx.pendingInterrupts.length; i++) {
			if (ctx.pendingInterrupts[i] === interruptNumber) {
				skip = true;
				break;
			}
		}
		if (!skip) {
			ctx.pendingInterrupts.push(interruptNumber);
			ctx.pendingInterrupts.sort(externalInterruptSorter);
		}
		ctx.halted = false;
		if (!ctx.pendingIO) {
			if (stepPending) {
				stepPending = false;
				continueOnResumption = false;
				this.onStepFinished.notify(this, false, false, false, false);
			} else {
				if (continueOnResumption) {
					continueOnResumption = false;
					if (!running) return internalRun.call(this);
				}
			}
		}
		return true;
	};
	this.resumeFromIO = function () {
		var ctx = this.context;
		if (!ctx.pendingIO) return false;
		if (ctx.pendingIO < 0) { //in
			if (ctx.pendingIO === -1) {
				ctx.pendingIOreg.set(ctx.ioArray.getUint32(0, true));
			} else {
				if (ctx.setMem(ctx.pendingIOreg.get(), ctx.ioArray.getUint32(0, true), ctx.pendingIOsize))
					ctx.pendingIOreg.set(ctx.pendingIOreg.get() + (ctx.flagDir ? -ctx.pendingIOsize : ctx.pendingIOsize));
			}
		} else { //out
			if (ctx.pendingIOreg)
				ctx.pendingIOreg.set(ctx.pendingIOreg.get() + (ctx.flagDir ? -ctx.pendingIOsize : ctx.pendingIOsize));
		}
		ctx.pendingIO = 0;
		ctx.pendingIOreg = null;
		ctx.pendingIOsize = 0;
		if (stepPending) {
			stepPending = false;
			continueOnResumption = false;
			this.onStepFinished.notify(this, false, ctx.halted, false, ctx.errorOccurred);
		} else {
			if (ctx.errorOccurred) {
				continueOnResumption = false;
				this.onStoppedRunning.notify(this, false, false, ctx.halted, false, ctx.errorOccurred);
			} else if (continueOnResumption) {
				return internalRun.call(this);
			}
		}
		return true;
	};
	this.run = function () {
		if (!compiled || this.isRunningOrWaiting()) return false;
		return internalRun.call(this);
	};
	this.step = function () {
		if (!compiled || this.isRunningOrWaiting()) return false;
		var ctx = this.context;
		running = true;
		stepPending = false;
		continueOnResumption = false;
		ctx.errorOccurred = false;
		ctx.step(true);
		running = false;
		if (ctx.dbgReq) {
			ctx.halted = false;
			ctx.dbgReq = false;
		}
		stepPending = (ctx.halted || !!ctx.pendingIO);
		this.onStepFinished.notify(this, false, ctx.halted, !!ctx.pendingIO, ctx.errorOccurred);
		return true;
	}
	this.addVariable = function (name, size, initialContents, forceArray) {
		if (this.isRunningOrWaiting()) return false;
		compiled = false;
		if (!name || !name.length || name.indexOf(" ") > 0 || name.indexOf("\t") > 0 || name.charCodeAt(0) < 0x0041) {
			this.onVariableError.notify(this, Asm86Emulator.prototype.MESSAGES.INVALID_VARIABLE_NAME + "\"" + name + "\"");
			return false;
		}
		var lName = name.toLocaleLowerCase(), v = vars[lName];
		if (v) {
			this.onVariableError.notify(this, Asm86Emulator.prototype.MESSAGES.DUPLICATE_VARIABLE + "\"" + name + "\"");
			return false;
		}
		if (lName !== "_in") {
			switch (lName) {
				case "dword":
				case "word":
				case "byte":
				case "ptr":
				case "in":
					this.onVariableError.notify(this, Asm86Emulator.prototype.MESSAGES.INVALID_VARIABLE_NAME + "\"" + name + "\"");
					return false;
			}
			if (Asm86Emulator.prototype.OP[lName] || this.context.regs[lName]) {
				this.onVariableError.notify(this, Asm86Emulator.prototype.MESSAGES.INVALID_VARIABLE_NAME + "\"" + name + "\"");
				return false;
			}
		}
		if (!size || size < 0 || size > this.context.memorySize) {
			if (size || initialContents === undefined || initialContents === null) {
				this.onVariableError.notify(this, Asm86Emulator.prototype.MESSAGES.INVALID_VARIABLE_SIZE + size.toString());
				return false;
			}
		}
		v = Asm86Emulator.prototype._createVariable(this.context, name, (size ? (size | 0) : 0), initialContents, forceArray);
		vars[lName] = v;
		this.onVariableAdded.notify(this, v);
		return true;
	};
	this.removeVariable = function (name) {
		if (this.isRunningOrWaiting()) return false;
		compiled = false;
		var lName = name.toLocaleLowerCase(), v = vars[lName];
		if (v) {
			delete vars[lName];
			this.onVariableRemoved.notify(this, v);
			return true;
		}
		return false;
	};
	this.compile = function (code) {
		if (this.isRunningOrWaiting()) return false;
		compiled = false;
		this.context.instructions.splice(0, this.context.instructions.length);
		if (!Asm86Emulator.prototype._createCompiler(this).compile(code, vars)) {
			this.onCompilationFinished.notify(this, true);
			return false;
		}
		compiled = true;
		this.reset();
		this.onCompilationFinished.notify(this, false);
		return true;
	};
	this.getOperatorArray = function () {
		var a = [], o;
		for (o in Asm86Emulator.prototype.OP) {
			a.push(o);
		}
		a.sort();
		return a;
	};
	this.reset();
	Object.freeze(this);
}
Asm86Emulator.prototype = {
	TYPE_REG: 1,
	TYPE_MEM: 2,
	TYPE_IMM: 4,
	VTYPE_NUMBER: 0,
	VTYPE_ARRAY: 1,
	VTYPE_STRING: 2,
	TYPE_LABELREF: 8,
	MESSAGES: {
		INVALID_OP_COUNT: "Contagem inválida de operandos",
		INVALID_DST_TYPE: "Tipo inválido do operando de destino",
		INVALID_SRC_TYPE: "Tipo inválido do operando de origem",
		MEM_MEM_NOT_ALLOWED: "Não é permitido utilizar operandos que acessem a memória ao mesmo tempo na origem e no destino",
		AL_AX_EAX_ONLY: "O primeiro operando deve ser um dos seguintes registradores: AL, AX ou EAX",
		AL_AX_EAX_ONLY_2: "O segundo operando deve ser um dos seguintes registradores: AL, AX ou EAX",
		CL_ONLY: "O segundo operando deve ser um valor imediato ou o registrador CL",
		DX_ONLY: "O primeiro operando deve ser um valor imediato ou o registrador DX",
		DX_ONLY_2: "O segundo operando deve ser um valor imediato ou o registrador DX",
		IMM_BETWEEN_0_255: "O valor imediato deve estar entre 0 e 255",
		INVALID_INTERRUPT: "O número da interrupção deve ser 3, ou estar entre 32 e 255",
		DST16_32_ONLY: "É permitido utilizar apenas registradores de 16 ou 32 bits como operando de destino",
		SRC16_32_ONLY: "É permitido utilizar apenas registradores de 16 ou 32 bits como operando de origem",
		ANY_DST8_16_32_ONLY: "É permitido utilizar apenas operandos de 8, 16 ou 32 bits como destino",
		ANY_SRC8_16_32_ONLY: "É permitido utilizar apenas operandos de 8, 16 ou 32 bits como origem",
		ANY_DST8_ONLY: "É permitido utilizar apenas operandos de 8 bits como destino",
		ANY_DST16_32_ONLY: "É permitido utilizar apenas operandos de 16 ou 32 bits como destino",
		NO_EIP: "Não é possível acessar o registrador EIP diretamente",
		REG32_ONLY: "É permitido utilizar apenas registradores de 32 bits como operando",
		DST_SRC_SIZE_MISMATCH: "Conflito entre o tamanho dos operandos de origem e de destino",
		DST_SRC_SIZE_UNKNOWN: "Tamanho desconhecido dos operandos de destino e de origem",
		DST_SIZE_UNKNOWN: "Tamanho desconhecido do operando de destino",
		SRC_SIZE_UNKNOWN: "Tamanho desconhecido do operando de origem",
		INVALID_READ_ADDRESS: "Endereço inválido para leitura: ",
		INVALID_READ_SIZE: "Tamanho inválido para leitura: ",
		INVALID_WRITE_ADDRESS: "Endereço inválido para escrita: ",
		INVALID_WRITE_SIZE: "Tamanho inválido para escrita: ",
		INVALID_INSTRUCTION_ADDRESS: "Endereço de instrução inválido: ",
		DIVISION_BY_0: "Divisão por 0",
		DIVISION_OVERFLOW: "Estouro no quociente da divisão",
		DUPLICATE_LABEL: "Nome de label repetido: ",
		DUPLICATE_VARIABLE: "Nome de variável repetido: ",
		INVALID_VARIABLE_SIZE: "Tamanho de variável inválido: ",
		INVALID_VARIABLE_NAME: "Nome de variável inválido: ",
		UNKNOWN_LABEL: "Nome de label desconhecido: ",
		UNKNOWN_OPERATOR: "Operador desconhecido: ",
		LABEL_OR_OPERATOR_EXPECTED: "Era esperado um label ou um operador",
		OPERATOR_EXPECTED_AFTER_PREFIX: "Era esperado um operador depois do prefixo",
		OPERATOR_CANNOT_HAVE_PREFIX: "Esse operador não pode ser utilizado com um prefixo",
		OPERAND_EXPECTED: "Era esperado um operando",
		COLON_EXPECTED: "Definição de label incompleta: era esperado o caractere \":\"",
		COMMA_EXPECTED: "Era esperado o caractere \",\"",
		UNKNOWN_VARIABLE: "Nome de variável desconhecido: ",
		NOT_ENOUGH_SPACE: "O tamanho total ocupado pelas variáveis excede o tamanho da memória: ",
		PTR_EXPECTED: "Expressão de memória inválida: era esperado \"ptr\"",
		SQBRACKET_EXPECTED: "Expressão de memória inválida: era esperado o caractere \"[\"",
		INVALID_MEMORY_REF_FORMAT: "Formato de expressão de memória inválido",
		INVALID_SCALE: "A escala de um registrador deve ser 1, 2, 4 ou 8",
		INVALID_NUMBER: "Número inválido",
		VALUE_OUT_OF_RANGE: "Valor fora dos limites permitidos",
		INVALID_CHAR: "Caractere inválido: "
	},
	_numericHelper: new DataView(new ArrayBuffer(4)),
	_numeric: function (x, mode, size) {
		//x is expected to be an unsigned value
		switch (mode) {
			case 0:
				return Asm86Emulator.prototype._hex(x, size);
			case 1:
				return x.toString(10) + " (u)";
		}
		if (!size || size === 4) {
			Asm86Emulator.prototype._numericHelper.setUint32(0, x);
			return Asm86Emulator.prototype._numericHelper.getInt32(0).toString(10) + " (s)";
		} else if (size === 2) {
			Asm86Emulator.prototype._numericHelper.setUint16(0, x);
			return Asm86Emulator.prototype._numericHelper.getInt16(0).toString(10) + " (s)";
		}
		Asm86Emulator.prototype._numericHelper.setUint8(0, x);
		return Asm86Emulator.prototype._numericHelper.getInt8(0).toString(10) + " (s)";
	},
	_hex: function (x, size) {
		//x is expected to be an unsigned value
		return "0x" + Asm86Emulator.prototype._hexNoPrefix(x, size);
	},
	_hexNoPrefix: function (x, size) {
		//x is expected to be an unsigned value
		var s;
		if (!size || size === 4) {
			s = "0000000" + x.toString(16).toUpperCase();
			return s.substr(s.length - 8);
		} else if (size === 3) {
			s = "00000" + x.toString(16).toUpperCase();
			return s.substr(s.length - 6);
		} else if (size === 2) {
			s = "000" + x.toString(16).toUpperCase();
			return s.substr(s.length - 4);
		}
		s = "0" + x.toString(16).toUpperCase();
		return s.substr(s.length - 2);
	},
	_createContext: function (emulator, memorySize, inputFunction, outputFunction) {
		return new Asm86EmulatorContext(function (message) { return emulator.onRuntimeError.notify(emulator, message); }, memorySize, inputFunction, outputFunction);
	},
	_createCompiler: function (emulator) {
		return new Asm86Compiler(emulator.context, function (message, line, lineIndex, index) { return emulator.onCompilationError.notify(emulator, message, line, lineIndex, index); });
	},
	_createVariable: function (ctx, name, size, initialContents, forceArray) {
		//do not freeze!
		var v = {
			get: function () { return ctx.getMem(this.address, size); },
			set: function (x) { ctx.setMem(this.address, x, size); },
			getAddress: function () { return this.address; },
			address: -1,
			size: ((initialContents !== null && initialContents !== undefined) ? ((typeof initialContents === "string") ? ((initialContents.length + 1) << 1) : (initialContents.length ? initialContents.length : size)) : size),
			name: name,
			vType: ((typeof initialContents === "string") ? Asm86Emulator.prototype.VTYPE_STRING : ((size > 4 || (initialContents && initialContents.length) || forceArray) ? Asm86Emulator.prototype.VTYPE_ARRAY : Asm86Emulator.prototype.VTYPE_NUMBER)),
			type: Asm86Emulator.prototype.TYPE_MEM,
			initialContents: initialContents
		};
		Object.seal(v);
		return v;
	},
	_fillVariables: function (ctx, vars) {
		var name, i, v, c, size;
		for (name in vars) {
			v = vars[name];
			c = v.initialContents;
			if (c !== undefined && c !== null) {
				if (typeof c === "string") {
					//copy the unicode string into memory
					for (i = 0; i < c.length; i++)
						ctx.setMem(v.address + (i << 1), c.charCodeAt(i), 2);
					ctx.setMem(v.address + (i << 1), 0, 2);
				} else if (c.length) {
					//copy the array into memory
					for (i = 0; i < c.length; i++)
						ctx.setMem(v.address + i, c[i], 1);
				} else {
					ctx.setMem(v.address, c, v.size);
				}
			}
		}
		return true;
	},
	_validate: function (op1, op2, ignoreOp2Size, ignoreOp1Size) {
		switch (this.operandCount) {
			case 0:
				if (op1 || op2) return Asm86Emulator.prototype.MESSAGES.INVALID_OP_COUNT;
				break;
			case 1:
				if (!op1 || op2) return Asm86Emulator.prototype.MESSAGES.INVALID_OP_COUNT;
				if (!(op1.type & this.op1Type)) return Asm86Emulator.prototype.MESSAGES.INVALID_DST_TYPE;
				break;
			case 2:
				if (!op1 || !op2) return Asm86Emulator.prototype.MESSAGES.INVALID_OP_COUNT;
				if (!(op1.type & this.op1Type)) return Asm86Emulator.prototype.MESSAGES.INVALID_DST_TYPE;
				if (!(op2.type & this.op2Type)) return Asm86Emulator.prototype.MESSAGES.INVALID_SRC_TYPE;
				if (op1.type === Asm86Emulator.prototype.TYPE_MEM && op2.type === Asm86Emulator.prototype.TYPE_MEM) return Asm86Emulator.prototype.MESSAGES.MEM_MEM_NOT_ALLOWED;
				break;
		}
		if (!ignoreOp1Size && op1 && op1.size && op1.size !== 1 && op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.ANY_DST8_16_32_ONLY;
		if (!ignoreOp2Size && op2 && op2.size && op2.size !== 1 && op2.size !== 2 && op2.size !== 4) return Asm86Emulator.prototype.MESSAGES.ANY_SRC8_16_32_ONLY;
		if ((op1 && op1.type === Asm86Emulator.prototype.TYPE_REG && op1.name === "eip") || (op2 && op2.type === Asm86Emulator.prototype.TYPE_REG && op2.name === "eip")) return Asm86Emulator.prototype.MESSAGES.NO_EIP;
		return null;
	},
	_validate2op: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (!op1.size && !op2.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_UNKNOWN;
		else if (!op1.size) op1.changeSize(op2.size);
		else if (!op2.size) op2.changeSize(op1.size);
		else if (op1.size !== op2.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_MISMATCH;
		return null;
	},
	_validateCMOV: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
		if (!op2.size) op2.changeSize(op1.size);
		if (op1.size !== op2.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_MISMATCH;
		return null;
	},
	_validateSET: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 1) return Asm86Emulator.prototype.MESSAGES.ANY_DST8_ONLY;
		return null;
	},
	_validateBT: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
		if (op2.type === Asm86Emulator.prototype.TYPE_REG && op2.size !== 2 && op2.size !== 4) return Asm86Emulator.prototype.MESSAGES.SRC16_32_ONLY;
		if (op1.size !== op2.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_MISMATCH;
		return null;
	},
	_validateBS: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
		if (op1.size !== op2.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_MISMATCH;
		return null;
	},
	_validate1op: function (op1) {
		var r = Asm86Emulator.prototype._validate.call(this, op1);
		if (r) return r;
		if (!op1.size) return Asm86Emulator.prototype.MESSAGES.DST_SIZE_UNKNOWN;
		return null;
	},
	_validateMovx: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
		if (op2.size >= op1.size) return Asm86Emulator.prototype.MESSAGES.DST_SRC_SIZE_MISMATCH;
		if (!op2.size) return Asm86Emulator.prototype.MESSAGES.SRC_SIZE_UNKNOWN;
		return null;
	},
	_validateXSR: function (op1, op2) {
		return Asm86Emulator.prototype._validate.call(this, op1, op2, true, true);
	},
	_validateShift: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op2.type === Asm86Emulator.prototype.TYPE_REG && op2.name !== "cl") return Asm86Emulator.prototype.MESSAGES.CL_ONLY;
		return null;
	},
	_validateIn: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.name !== "al" && op1.name !== "ax" && op1.name !== "eax") return Asm86Emulator.prototype.MESSAGES.AL_AX_EAX_ONLY;
		if (op2.type === Asm86Emulator.prototype.TYPE_IMM && (op2.get() < 0 || op2.get() > 255)) return Asm86Emulator.prototype.MESSAGES.IMM_BETWEEN_0_255;
		if (op2.type === Asm86Emulator.prototype.TYPE_REG && op2.name !== "dx") return Asm86Emulator.prototype.MESSAGES.DX_ONLY_2;
		return null;
	},
	_validateOut: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.type === Asm86Emulator.prototype.TYPE_IMM && (op1.get() < 0 || op1.get() > 255)) return Asm86Emulator.prototype.MESSAGES.IMM_BETWEEN_0_255;
		if (op1.type === Asm86Emulator.prototype.TYPE_REG && op1.name !== "dx") return Asm86Emulator.prototype.MESSAGES.DX_ONLY;
		if (op2.name !== "al" && op2.name !== "ax" && op2.name !== "eax") return Asm86Emulator.prototype.MESSAGES.AL_AX_EAX_ONLY_2;
		return null;
	},
	_validateIDT: function (op1, op2) {
		var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
		if (r) return r;
		if (op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.REG32_ONLY;
		return null;
	},
	_flagOvAdd: function (ctx, a, b, result, size) {
		var ma = 0, mb = 0, mr = 0, bit = (size << 3) - 1;
		ma = ((a >>> bit) & 1);
		mb = ((b >>> bit) & 1);
		mr = ((result >>> bit) & 1);
		ctx.flagOv = ((ma !== mb) ? 0 : ((ma === mr) ? 0 : 1));
		return result;
	},
	_flagOvSub: function (ctx, a, b, result, size) {
		var ma = 0, mb = 0, mr = 0, bit = (size << 3) - 1;
		ma = ((a >>> bit) & 1);
		mb = ((b >>> bit) & 1);
		mr = ((result >>> bit) & 1);
		ctx.flagOv = ((ma === mb) ? 0 : ((ma === mr) ? 0 : 1));
		return result;
	},
	_flagSign: function (ctx, result, size) {
		ctx.flagSign = ((result >>> ((size << 3) - 1)) & 1);
		return result;
	},
	_flagZ: function (ctx, result, size) {
		switch (size) {
			case 1:
				ctx.flagZ = ((result & 0xFF) ? 0 : 1);
				break;
			case 2:
				ctx.flagZ = ((result & 0xFFFF) ? 0 : 1);
				break;
			case 4:
				ctx.flagZ = ((result & 0xFFFFFFFF) ? 0 : 1);
				break;
		}
		return result;
	},
	_flagCarry: function (ctx, result, size) {
		switch (size) {
			case 1:
				ctx.flagCarry = ((result > 0xFF) ? 1 : 0);
				break;
			case 2:
				ctx.flagCarry = ((result > 0xFFFF) ? 1 : 0);
				break;
			case 4:
				ctx.flagCarry = ((result > 0xFFFFFFFF) ? 1 : 0);
				break;
		}
		return result;
	}
};
Asm86Emulator.prototype.OP = {
	nop: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			return undefined;
		}
	},
	clc: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagCarry = 0;
			return undefined;
		}
	},
	stc: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagCarry = 1;
			return undefined;
		}
	},
	cmc: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagCarry ^= 1;
			return undefined;
		}
	},
	cld: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagDir = 0;
			return undefined;
		}
	},
	std: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagDir = 1;
			return undefined;
		}
	},
	cli: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagI = 0;
			return undefined;
		}
	},
	sti: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.flagI = 1;
			return undefined;
		}
	},
	cwd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.regs.dx.set((ctx.regs.ax.get() & 0x8000) ? -1 : 0);
			return undefined;
		}
	},
	cdq: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.regs.edx.set((ctx.regs.eax.get() & 0x80000000) ? -1 : 0);
			return undefined;
		}
	},
	bt: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validateBT,
		exec: function (ctx, op1, op2) {
			var a, d, s = op2.get(), tmp;
			if (op1.type === Asm86Emulator.prototype.TYPE_REG || op2.type === Asm86Emulator.prototype.TYPE_IMM) {
				ctx.flagCarry = ((op1.get() >>> (s & ((op1.size === 4) ? 31 : 15))) & 1);
			} else {
				tmp = ctx.tmp4Byte;
				if (op1.size === 4) {
					tmp.setUint32(0, s, true);
					s = tmp.getInt32(0, true);
				} else {
					tmp.setUint16(0, s, true);
					s = tmp.getInt16(0, true);
				}
				a = op1.getAddress() + (s >> 3);
				s &= 7;
				if ((d = ctx.getMem(a, 1)) !== null) {
					ctx.flagCarry = ((d >>> s) & 1);
				}
			}
			return undefined;
		}
	},
	btc: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validateBT,
		exec: function (ctx, op1, op2) {
			var a, d, s = op2.get(), tmp;
			if (op1.type === Asm86Emulator.prototype.TYPE_REG || op2.type === Asm86Emulator.prototype.TYPE_IMM) {
				s &= ((op1.size === 4) ? 31 : 15);
				ctx.flagCarry = ((op1.get() >>> s) & 1);
				return op1.set(op1.get() ^ (1 << s));
			} else {
				tmp = ctx.tmp4Byte;
				if (op1.size === 4) {
					tmp.setUint32(0, s, true);
					s = tmp.getInt32(0, true);
				} else {
					tmp.setUint16(0, s, true);
					s = tmp.getInt16(0, true);
				}
				a = op1.getAddress() + (s >> 3);
				s &= 7;
				if ((d = ctx.getMem(a, 1)) !== null) {
					ctx.flagCarry = ((d >>> s) & 1);
					return ctx.setMem(a, d ^ (1 << s), 1);
				}
				return undefined;
			}
		}
	},
	btr: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validateBT,
		exec: function (ctx, op1, op2) {
			var a, d, s = op2.get(), tmp;
			if (op1.type === Asm86Emulator.prototype.TYPE_REG || op2.type === Asm86Emulator.prototype.TYPE_IMM) {
				s &= ((op1.size === 4) ? 31 : 15);
				ctx.flagCarry = ((op1.get() >>> s) & 1);
				return op1.set(op1.get() & ~(1 << s));
			} else {
				tmp = ctx.tmp4Byte;
				if (op1.size === 4) {
					tmp.setUint32(0, s, true);
					s = tmp.getInt32(0, true);
				} else {
					tmp.setUint16(0, s, true);
					s = tmp.getInt16(0, true);
				}
				a = op1.getAddress() + (s >> 3);
				s &= 7;
				if ((d = ctx.getMem(a, 1)) !== null) {
					ctx.flagCarry = ((d >>> s) & 1);
					return ctx.setMem(a, d & ~(1 << s), 1);
				}
				return undefined;
			}
		}
	},
	bts: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validateBT,
		exec: function (ctx, op1, op2) {
			var a, d, s = op2.get(), tmp;
			if (op1.type === Asm86Emulator.prototype.TYPE_REG || op2.type === Asm86Emulator.prototype.TYPE_IMM) {
				s &= ((op1.size === 4) ? 31 : 15);
				ctx.flagCarry = ((op1.get() >>> s) & 1);
				return op1.set(op1.get() | (1 << s));
			} else {
				tmp = ctx.tmp4Byte;
				if (op1.size === 4) {
					tmp.setUint32(0, s, true);
					s = tmp.getInt32(0, true);
				} else {
					tmp.setUint16(0, s, true);
					s = tmp.getInt16(0, true);
				}
				a = op1.getAddress() + (s >> 3);
				s &= 7;
				if ((d = ctx.getMem(a, 1)) !== null) {
					ctx.flagCarry = ((d >>> s) & 1);
					return ctx.setMem(a, d | (1 << s), 1);
				}
				return undefined;
			}
		}
	},
	mov: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM | Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var b = op2.get();
			if (ctx.errorOccurred) return undefined;
			return op1.set(b);
		}
	},
	movzx: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateMovx,
		exec: function (ctx, op1, op2) {
			var b = op2.get();
			if (ctx.errorOccurred) return undefined;
			return op1.set(b);
		}
	},
	movsx: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateMovx,
		exec: function (ctx, op1, op2) {
			var b = op2.get(), bit = 32 - (op2.size << 3);
			if (ctx.errorOccurred) return undefined;
			return op1.set((b << bit) >> bit);
		}
	},
	xchg: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			op2.set(a);
			return op1.set(b);
		}
	},
	lea: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //16 or 32 bits only!
		op2Type: Asm86Emulator.prototype.TYPE_MEM,
		validate: function (op1, op2) {
			var r = Asm86Emulator.prototype._validate.call(this, op1, op2, true);
			if (r) return r;
			if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
			return null;
		},
		exec: function (ctx, op1, op2) {
			return op1.set(op2.getAddress());
		}
	},
	not: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			var a = op1.get();
			if (ctx.errorOccurred) return undefined;
			return op1.set(~a);
		}
	},
	neg: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), r;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(-a);
			if (ctx.errorOccurred) return undefined;
			if (r) {
				ctx.flagCarry = 1;
				ctx.flagZ = 0;
			} else {
				ctx.flagCarry = 0;
				ctx.flagZ = 1;
			}
			ctx.flagOv = 0;
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	test: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			ctx.uint32Tmp[0] = a & b;
			r = ctx.uint32Tmp[0];
			ctx.flagCarry = 0;
			ctx.flagOv = 0;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	and: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a & b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = 0;
			ctx.flagOv = 0;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	or: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a | b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = 0;
			ctx.flagOv = 0;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	xor: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a ^ b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = 0;
			ctx.flagOv = 0;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	bsf: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //16 or 32 bits only!
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateBS,
		exec: function (ctx, op1, op2) {
			var y, n, s;
			if ((s = op2.get()) !== null) {
				if (!s) {
					ctx.flagZ = 1;
				} else {
					ctx.flagZ = 0;
					//Modification of Hacker's Delight, Figure 5-14, to simulate the exact BSF behavior
					n = 31;
					if ((y = (s << 16))) { n = n - 16; s = y; }
					if ((y = (s << 8))) { n = n - 8; s = y; }
					if ((y = (s << 4))) { n = n - 4; s = y; }
					if ((y = (s << 2))) { n = n - 2; s = y; }
					return op1.set(n - ((s << 1) >>> 31));
				}
			}
			return undefined;
		}
	},
	bsr: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //16 or 32 bits only!
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateBS,
		exec: function (ctx, op1, op2) {
			var n, s;
			if ((s = op2.get()) !== null) {
				if (!s) {
					ctx.flagZ = 1;
				} else {
					ctx.flagZ = 0;
					//Modification of Hacker's Delight, Figure 5-6, to simulate the exact BSR behavior
					n = 1;
					if (!(s >>> 16)) { n += 16; s <<= 16; }
					if (!(s >>> 24)) { n += 8; s <<= 8; }
					if (!(s >>> 28)) { n += 4; s <<= 4; }
					if (!(s >>> 30)) { n += 2; s <<= 2; }
					n -= s >>> 31;
					return op1.set(31 - n);
				}
			}
			return undefined;
		}
	},
	bswap: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //32 bits only!
		validate: function (op1) {
			var r = Asm86Emulator.prototype._validate.call(this, op1);
			if (r) return r;
			if (op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.REG32_ONLY;
			return null;
		},
		exec: function (ctx, op1) {
			var a = op1.get();
			return op1.set(((a >>> 24) & 0xFF) | ((a >>> 8) & 0xFF00) | ((a & 0xFF00) << 8) | ((a & 0xFF) << 24));
		}
	},
	add: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r, rt;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			rt = a + b;
			r = op1.set(rt);
			if (ctx.errorOccurred) return undefined;
			Asm86Emulator.prototype._flagCarry(ctx, rt, op1.size);
			Asm86Emulator.prototype._flagOvAdd(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	adc: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r, rt;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			rt = a + b + ctx.flagCarry;
			r = op1.set(rt);
			if (ctx.errorOccurred) return undefined;
			Asm86Emulator.prototype._flagCarry(ctx, rt, op1.size);
			Asm86Emulator.prototype._flagOvAdd(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	sub: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a - b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = ((b > a) ? 1 : 0);
			Asm86Emulator.prototype._flagOvSub(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	sbb: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			if (ctx.flagCarry) {
				r = op1.set(a - b - 1);
				if (ctx.errorOccurred) return undefined;
				ctx.flagCarry = ((b >= a) ? 1 : 0);
			} else {
				r = op1.set(a - b);
				if (ctx.errorOccurred) return undefined;
				ctx.flagCarry = ((b > a) ? 1 : 0);
			}
			Asm86Emulator.prototype._flagOvSub(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	inc: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), r;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a + 1);
			if (ctx.errorOccurred) return undefined;
			Asm86Emulator.prototype._flagOvAdd(ctx, a, 1, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	dec: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), r;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a - 1);
			if (ctx.errorOccurred) return undefined;
			Asm86Emulator.prototype._flagOvSub(ctx, a, 1, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	cmp: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			if (ctx.errorOccurred) return undefined;
			ctx.uint32Tmp[0] = a - b;
			ctx.flagCarry = (b > a) ? 1 : 0;
			r = ctx.uint32Tmp[0];
			Asm86Emulator.prototype._flagOvSub(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	rcl: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r, c = ctx.flagCarry;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a << b | c << (b - 1) | (a >>> ((op1.size << 3) - b + 1)) & ((1 << (b - 1)) - 1));
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> ((op1.size << 3) - b)) & 1;
			if (b === 1) ctx.flagOv = ctx.flagCarry ^ ((a >>> (op1.size << 3) - 2) & 1);
			return r;
		}
	},
	rcr: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r, c = ctx.flagCarry;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(((a & ((1 << (b - 1)) - 1)) << ((op1.size << 3) - b + 1)) | (c << ((op1.size << 3) - b)) | (a >>> b));
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> (b - 1)) & 1;
			if (b === 1) ctx.flagOv = c ^ ((a >>> (op1.size << 3) - 1) & 1);
			return r;
		}
	},
	rol: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set((a << b) | ((a >>> ((op1.size << 3) - b)) & ((1 << b) - 1)));
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> ((op1.size << 3) - b)) & 1;
			if (b === 1) ctx.flagOv = ctx.flagCarry ^ ((a >>> (op1.size << 3) - 2) & 1);
			return r;
		}
	},
	ror: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(((a & ((1 << b) - 1)) << ((op1.size << 3) - b)) | (a >>> b));
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> (b - 1)) & 1;
			if (b === 1) ctx.flagOv = ctx.flagCarry ^ ((a >>> (op1.size << 3) - 1) & 1);
			return r;
		}
	},
	shl: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a << b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> ((op1.size << 3) - b)) & 1;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
			if (b === 1) ctx.flagOv = ctx.flagCarry ^ ctx.flagSign;
			return r;
		}
	},
	shr: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			r = op1.set(a >>> b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> (b - 1)) & 1;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
			if (b === 1) ctx.flagOv = ((a >>> ((op1.size << 3) - 1)) & 1);
			return r;
		}
	},
	sar: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm or CL only!
		validate: Asm86Emulator.prototype._validateShift,
		exec: function (ctx, op1, op2) {
			var a = op1.get(), b = op2.get() & 31, r, tmp = ctx.tmp4Byte;
			if (!b) return a;
			if (ctx.errorOccurred) return undefined;
			switch (op1.size) {
				case 1:
					//sign extend
					tmp.setInt8(0, a);
					a = tmp.getInt8(0);
					break;
				case 2:
					tmp.setInt16(0, a);
					a = tmp.getInt16(0);
					break;
			}
			r = op1.set(a >> b);
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = (a >>> (b - 1)) & 1;
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
			if (b === 1) ctx.flagOv = 0;
			return r;
		}
	},
	push: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_IMM,
		validate: function (op1) {
			var r = Asm86Emulator.prototype._validate.call(this, op1);
			if (r) return r;
			if (op1.type === Asm86Emulator.prototype.TYPE_IMM) {
				op1.changeSize(4); //force immediates to 32 bits...
				return null;
			}
			if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.ANY_DST16_32_ONLY;
			return null;
		},
		exec: function (ctx, op1) {
			var a = op1.get();
			if (ctx.errorOccurred) return undefined;
			return ctx.setMem(ctx.regs.esp.set(ctx.regs.esp.get() - op1.size), a, op1.size);
		}
	},
	pushad: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			var tmp = ctx.regs.esp.get();
			ctx.regs.esp.set(tmp - (8 << 2));
			if (ctx.setMem(tmp - (8 << 2), ctx.regs.edi.get(), 4)) {
				ctx.setMem(tmp - (1 << 2), ctx.regs.eax.get(), 4);
				ctx.setMem(tmp - (2 << 2), ctx.regs.ecx.get(), 4);
				ctx.setMem(tmp - (3 << 2), ctx.regs.edx.get(), 4);
				ctx.setMem(tmp - (4 << 2), ctx.regs.ebx.get(), 4);
				ctx.setMem(tmp - (5 << 2), tmp, 4);
				ctx.setMem(tmp - (6 << 2), ctx.regs.ebp.get(), 4);
				ctx.setMem(tmp - (7 << 2), ctx.regs.esi.get(), 4);
			}
			return undefined;
		}
	},
	pushfd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			return ctx.setMem(ctx.regs.esp.set(ctx.regs.esp.get() - 4), ctx.getFlags(), 4);
		}
	},
	pop: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: function (op1) {
			var r = Asm86Emulator.prototype._validate.call(this, op1);
			if (r) return r;
			if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.ANY_DST16_32_ONLY;
			return null;
		},
		exec: function (ctx, op1) {
			var addr = ctx.regs.esp.get(), v;
			if ((v = ctx.getMem(addr, op1.size)) !== null) {
				op1.set(v);
				if (ctx.errorOccurred) return undefined;
				return ctx.regs.esp.set(addr + op1.size);
			}
			return undefined;
		}
	},
	popad: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			var addr = ctx.regs.esp.get(), v;
			if ((v = ctx.getMem(addr + (7 << 2), 4)) !== null) {
				ctx.regs.eax.set(v);
				ctx.regs.ecx.set(ctx.getMem(addr + (6 << 2), 4));
				ctx.regs.edx.set(ctx.getMem(addr + (5 << 2), 4));
				ctx.regs.ebx.set(ctx.getMem(addr + (4 << 2), 4));
				//skip esp
				ctx.regs.ebp.set(ctx.getMem(addr + (2 << 2), 4));
				ctx.regs.esi.set(ctx.getMem(addr + (1 << 2), 4));
				ctx.regs.edi.set(ctx.getMem(addr, 4));
				return ctx.regs.esp.set(addr + (8 << 4));
			}
			return undefined;
		}
	},
	popfd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			var addr = ctx.regs.esp.get(), v;
			if ((v = ctx.getMem(addr, 4)) !== null) {
				ctx.setFlags(v);
				return ctx.regs.esp.set(addr + 4);
			}
			return undefined;
		}
	},
	call: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			var a = op1.get();
			if (ctx.errorOccurred) return undefined;
			if (ctx.setMem(ctx.regs.esp.set(ctx.regs.esp.get() - 4), ctx.nextInstruction, 4))
				ctx.nextInstruction = a;
			return undefined;
		}
	},
	ret: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_IMM,
		validate: function (op1, op2) {
			var r;
			if (op1 || op2) {
				r = Asm86Emulator.prototype._validate.call(this, op1, op2);
				if (r) return r;
			}
			if (op1 && !op1.size) op1.changeSize(4);
			return null;
		},
		exec: function (ctx, op1) {
			var addr = ctx.regs.esp.get(), v;
			if ((v = ctx.getMem(addr, 4)) !== null) {
				ctx.regs.esp.set(addr + (op1 ? (op1.get() + 4) : 4));
				ctx.nextInstruction = v;
			}
			return undefined;
		}
	},
	int: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_IMM,
		validate: function (op1, op2) {
			var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
			if (r) return r;
			if ((op1.get() !== 3) && (op1.get() < 32 || op1.get() > 255)) return Asm86Emulator.prototype.MESSAGES.INVALID_INTERRUPT;
			return null;
		},
		exec: function (ctx, op1) {
			var v = op1.get();
			if (v === 3) {
				ctx.halted = true;
				ctx.dbgReq = true;
				return undefined;
			} else {
				return ctx.gotoInterruptHandler(v);
			}
		}
	},
	iret: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			var addr = ctx.regs.esp.get(), v, v2;
			if ((v = ctx.getMem(addr, 4)) !== null) {
				if ((v2 = ctx.getMem(addr + 4, 4)) !== null) {
					ctx.regs.esp.set(addr + 8);
					ctx.setFlags(v2);
					ctx.nextInstruction = v;
				}
			}
			return undefined;
		}
	},
	hlt: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx) {
			ctx.halted = true;
			return undefined;
		}
	},
	jmp: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM | Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			var a = op1.get();
			if (ctx.errorOccurred) return undefined;
			ctx.nextInstruction = a;
			return undefined;
		}
	},
	jz: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jnz: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jae: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagCarry)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	ja: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagCarry && !ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jbe: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagCarry || ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jb: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagCarry)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jge: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagSign === ctx.flagOv)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jg: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagSign === ctx.flagOv && !ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jle: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagSign !== ctx.flagOv || ctx.flagZ)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jl: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagSign !== ctx.flagOv)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	js: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagSign)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jns: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagSign)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jo: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagOv)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	jno: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagOv)
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	loop: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.regs.ecx.set(ctx.regs.ecx.get() - 1))
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	loope: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (ctx.flagZ && ctx.regs.ecx.set(ctx.regs.ecx.get() - 1))
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	loopne: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_LABELREF,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1) {
			if (!ctx.flagZ && ctx.regs.ecx.set(ctx.regs.ecx.get() - 1))
				ctx.nextInstruction = op1.label.instructionIndex;
			return undefined;
		}
	},
	rep: {
		isPrefix: true,
		exec: function (ctx) {
			var c = ctx.regs.ecx.get();
			if (c) {
				ctx.regs.ecx.set(c - 1);
				return true;
			}
			return false; //return false to SKIP next instruction and stop repeating
		}
	},
	stosb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.edi.get();
			if (ctx.setMem(addr, ctx.regs.al.get(), 1))
				ctx.regs.edi.set(addr + (ctx.flagDir ? -1 : 1));
			return undefined;
		}
	},
	stosw: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.edi.get();
			if (ctx.setMem(addr, ctx.regs.ax.get(), 2))
				ctx.regs.edi.set(addr + (ctx.flagDir ? -2 : 2));
			return undefined;
		}
	},
	stosd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.edi.get();
			if (ctx.setMem(addr, ctx.regs.eax.get(), 4))
				ctx.regs.edi.set(addr + (ctx.flagDir ? -4 : 4));
			return undefined;
		}
	},
	lodsb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.esi.get(), v;
			if ((v = ctx.getMem(addr, 1)) !== null) {
				ctx.regs.al.set(v);
				ctx.regs.esi.set(addr + (ctx.flagDir ? -1 : 1));
			}
			return undefined;
		}
	},
	lodsw: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.esi.get(), v;
			if ((v = ctx.getMem(addr, 2)) !== null) {
				ctx.regs.ax.set(v);
				ctx.regs.esi.set(addr + (ctx.flagDir ? -2 : 2));
			}
			return undefined;
		}
	},
	lodsd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var addr = ctx.regs.esi.get(), v;
			if ((v = ctx.getMem(addr, 4)) !== null) {
				ctx.regs.eax.set(v);
				ctx.regs.esi.set(addr + (ctx.flagDir ? -4 : 4));
			}
			return undefined;
		}
	},
	movsb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), d = ctx.regs.edi.get(), v = ctx.getMem(s, 1);
			if (v !== null && ctx.setMem(d, v, 1)) {
				ctx.regs.esi.set(s + (ctx.flagDir ? -1 : 1));
				ctx.regs.edi.set(d + (ctx.flagDir ? -1 : 1));
			}
			return undefined;
		}
	},
	movsw: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), d = ctx.regs.edi.get(), v = ctx.getMem(s, 2);
			if (v !== null && ctx.setMem(d, v, 2)) {
				ctx.regs.esi.set(s + (ctx.flagDir ? -2 : 2));
				ctx.regs.edi.set(d + (ctx.flagDir ? -2 : 2));
			}
			return undefined;
		}
	},
	movsd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), d = ctx.regs.edi.get(), v = ctx.getMem(s, 4);
			if (v !== null && ctx.setMem(d, v, 4)) {
				ctx.regs.esi.set(s + (ctx.flagDir ? -4 : 4));
				ctx.regs.edi.set(d + (ctx.flagDir ? -4 : 4));
			}
			return undefined;
		}
	},
	_in: { //must be renamed from "in" to "_in" by the compiler
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //AL, AX or EAX only!
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm8 or DX only!
		validate: Asm86Emulator.prototype._validateIn,
		exec: function (ctx, op1, op2) {
			if (!ctx.inp(op2.get(), ctx.ioArray, op1.size)) {
				ctx.pendingIO = -1;
				ctx.pendingIOreg = op1;
				ctx.pendingIOsize = op1.size;
				return undefined;
			} else {
				return op1.set(ctx.ioArray.getUint32(0, true));
			}
		}
	},
	insb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var d;
			if (!ctx.inp(ctx.regs.dx.get(), ctx.ioArray, 1)) {
				ctx.pendingIO = -2;
				ctx.pendingIOreg = ctx.regs.edi;
				ctx.pendingIOsize = 1;
			} else {
				if (ctx.setMem((d = ctx.regs.edi.get()), ctx.ioArray.getUint8(0), 1))
					ctx.regs.edi.set(d + (ctx.flagDir ? -1 : 1));
			}
			return undefined;
		}
	},
	insw: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var d;
			if (!ctx.inp(ctx.regs.dx.get(), ctx.ioArray, 2)) {
				ctx.pendingIO = -2;
				ctx.pendingIOreg = ctx.regs.edi;
				ctx.pendingIOsize = 2;
			} else {
				if (ctx.setMem((d = ctx.regs.edi.get()), ctx.ioArray.getUint16(0, true), 2))
					ctx.regs.edi.set(d + (ctx.flagDir ? -2 : 2));
			}
			return undefined;
		}
	},
	insd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var d;
			if (!ctx.inp(ctx.regs.dx.get(), ctx.ioArray, 4)) {
				ctx.pendingIO = -2;
				ctx.pendingIOreg = ctx.regs.edi;
				ctx.pendingIOsize = 4;
			} else {
				if (ctx.setMem((d = ctx.regs.edi.get()), ctx.ioArray.getUint32(0, true), 4))
					ctx.regs.edi.set(d + (ctx.flagDir ? -4 : 4));
			}
			return undefined;
		}
	},
	out: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_IMM, //imm8 or DX only!
		op2Type: Asm86Emulator.prototype.TYPE_REG, //AL, AX or EAX only!
		validate: Asm86Emulator.prototype._validateOut,
		exec: function (ctx, op1, op2) {
			ctx.ioArray.setUint32(0, op2.get(), true);
			if (!ctx.outp(op1.get(), ctx.ioArray, op2.size)) {
				ctx.pendingIO = 1;
				ctx.pendingIOreg = null;
				ctx.pendingIOsize = op2.size;
			}
			return undefined;
		}
	},
	outsb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), v = ctx.getMem(s, 1);
			if (v !== null) {
				ctx.ioArray.setUint8(0, v);
				if (!ctx.outp(ctx.regs.dx.get(), ctx.ioArray, 1)) {
					ctx.pendingIO = 1;
					ctx.pendingIOreg = ctx.regs.esi;
					ctx.pendingIOsize = 1;
				} else {
					ctx.regs.esi.set(s + (ctx.flagDir ? -1 : 1));
				}
			}
			return undefined;
		}
	},
	outsw: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), v = ctx.getMem(s, 2);
			if (v !== null) {
				ctx.ioArray.setUint16(0, v, true);
				if (!ctx.outp(ctx.regs.dx.get(), ctx.ioArray, 2)) {
					ctx.pendingIO = 1;
					ctx.pendingIOreg = ctx.regs.esi;
					ctx.pendingIOsize = 2;
				} else {
					ctx.regs.esi.set(s + (ctx.flagDir ? -2 : 2));
				}
			}
			return undefined;
		}
	},
	outsd: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		acceptsPrefix: true,
		exec: function (ctx) {
			var s = ctx.regs.esi.get(), v = ctx.getMem(s, 4);
			if (v !== null) {
				ctx.ioArray.setUint32(0, v, true);
				if (!ctx.outp(ctx.regs.dx.get(), ctx.ioArray, 4)) {
					ctx.pendingIO = 1;
					ctx.pendingIOreg = ctx.regs.esi;
					ctx.pendingIOsize = 4;
				} else {
					ctx.regs.esi.set(s + (ctx.flagDir ? -4 : 4));
				}
			}
			return undefined;
		}
	},
	lidt: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //only 32 bits registers allowed here... not 1:1 with the documentation...
		validate: Asm86Emulator.prototype._validateIDT,
		exec: function (ctx, op1) {
			return (ctx.idt = op1.get());
		}
	},
	sidt: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //only 32 bits registers allowed here... not 1:1 with the documentation...
		validate: Asm86Emulator.prototype._validateIDT,
		exec: function (ctx, op1) {
			return op1.set(ctx.idt);
		}
	},
	xadd: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r, rt;
			if (ctx.errorOccurred) return undefined;
			b = op2.get();
			rt = a + b;
			r = op1.set(rt);
			if (ctx.errorOccurred) return undefined;
			op2.set(a);
			Asm86Emulator.prototype._flagCarry(ctx, rt, op1.size);
			Asm86Emulator.prototype._flagOvAdd(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			return Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
		}
	},
	cmpxchg: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		op2Type: Asm86Emulator.prototype.TYPE_REG,
		validate: Asm86Emulator.prototype._validate2op,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var a = op1.get(), b, r;
			if (ctx.errorOccurred) return undefined;
			switch (op1.size) {
				case 1:
					b = ctx.regs.al.get();
					break;
				case 2:
					b = ctx.regs.ax.get();
					break;
				case 4:
					b = ctx.regs.eax.get();
					break;
			}
			ctx.uint32Tmp[0] = a - b;
			ctx.flagCarry = (b > a) ? 1 : 0;
			r = ctx.uint32Tmp[0];
			Asm86Emulator.prototype._flagOvSub(ctx, a, b, r, op1.size);
			Asm86Emulator.prototype._flagZ(ctx, r, op1.size);
			Asm86Emulator.prototype._flagSign(ctx, r, op1.size);
			if (ctx.flagZ) {
				return op1.set(b);
			} else {
				switch (op1.size) {
					case 1:
						return ctx.regs.al.set(a);
					case 2:
						return ctx.regs.ax.set(a);
					case 4:
						return ctx.regs.eax.set(a);
				}
			}
			return undefined;
		}
	},
	xlatb: {
		operandCount: 0,
		validate: Asm86Emulator.prototype._validate,
		exec: function (ctx, op1, op2) {
			//AF FLAG
			var v = ctx.getMem(ctx.regs.ebx.get() + ctx.regs.al.get(), 1);
			if (v !== null)
				ctx.regs.al.set(v);
			return undefined;
		}
	},
	mul: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), b, a1, a2, b1, b2, A, B, C, K;
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = 0;
			switch (op1.size) {
				case 1:
					if ((0xFF00 & ctx.regs.ax.set(a * ctx.regs.al.get())))
						ctx.flagCarry = 1;
					break;
				case 2:
					b = a * ctx.regs.ax.get();
					ctx.regs.ax.set(b & 0xFFFF);
					if (ctx.regs.dx.set((b >>> 16) & 0xFFFF))
						ctx.flagCarry = 1;
					break;
				case 4:
					//Karatsuba FTW!
					b = ctx.regs.eax.get();
					a1 = (a >>> 16);
					a2 = (a & 0xFFFF);
					b1 = (b >>> 16);
					b2 = (b & 0xFFFF);
					A = a1 * b1;
					B = a2 * b2;
					C = (a1 + a2) * (b1 + b2);
					K = C - A - B;
					ctx.uint32Tmp[0] = (K & 0xFFFF) << 16;
					B += ctx.uint32Tmp[0];
					ctx.regs.eax.set(B);
					if (ctx.regs.edx.set(A + ((K >>> 16) & 0xFFFF) + ((K > 0xFFFFFFFF) ? 0x10000 : 0) + ((B > 0xFFFFFFFF) ? 1 : 0)))
						ctx.flagCarry = 1;
					break;
			}
			ctx.flagOv = ctx.flagCarry;
		}
	},
	imul: {
		operandCount: 1, //sorry, no 2/3 operand form :(
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), b, a1, a2, b1, b2, A, B, C, K, tmp = ctx.tmp4Byte, neg;
			if (ctx.errorOccurred) return undefined;
			ctx.flagCarry = 0;
			switch (op1.size) {
				case 1:
					//sign extend
					tmp.setInt8(0, a);
					a = tmp.getInt8(0);
					tmp.setInt8(0, ctx.regs.al.get());
					b = ctx.regs.ax.set(a * tmp.getInt8(0)) >>> 8;
					if (b && b !== 0xFF)
						ctx.flagCarry = 1;
					break;
				case 2:
					//sign extend
					tmp.setInt16(0, a);
					a = tmp.getInt16(0);
					tmp.setInt16(0, ctx.regs.ax.get());
					b = a * tmp.getInt16(0);
					ctx.regs.ax.set(b & 0xFFFF);
					b = ctx.regs.dx.set(b >>> 16);
					if (b && b !== 0xFFFF)
						ctx.flagCarry = 1;
					break;
				case 4:
					//Karatsuba FTW!
					//there is a nice workaround here (or "gambiarra" in portuguese), involving "neg", to deal with the signs...
					b = ctx.regs.eax.get();
					neg = 0;
					if (a >= 0x80000000) {
						neg = 1;
						a = (~a) + 1; //2's complement
					}
					if (b >= 0x80000000) {
						neg ^= 1;
						b = (~b) + 1; //2's complement
					}
					a1 = (a >>> 16);
					a2 = (a & 0xFFFF);
					b1 = (b >>> 16);
					b2 = (b & 0xFFFF);
					A = a1 * b1;
					B = a2 * b2;
					C = (a1 + a2) * (b1 + b2);
					K = C - A - B;
					ctx.uint32Tmp[0] = (K & 0xFFFF) << 16;
					B += ctx.uint32Tmp[0];
					if (neg) {
						//2's complement
						ctx.uint32Tmp[0] = B;
						ctx.regs.eax.set(~ctx.uint32Tmp[0] + 1);
					} else {
						ctx.regs.eax.set(B);
					}
					b = ctx.regs.edx.set(A + ((K >>> 16) & 0xFFFF) + ((K > 0xFFFFFFFF) ? 0x10000 : 0) + ((B > 0xFFFFFFFF) ? 1 : 0))
					if (neg)
						//2's complement
						b = ctx.regs.edx.set(~b + (ctx.uint32Tmp[0] ? 0 : 1));
					if (b && b !== 0xFFFFFFFF)
						ctx.flagCarry = 1;
					break;
			}
			ctx.flagOv = ctx.flagCarry;
		}
	},
	div: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), i, b, bl, q, r, tmp = ctx.uint32Tmp;
			if (ctx.errorOccurred) return undefined;
			if (!a) {
				ctx.errorOccurred = true;
				ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_BY_0);
				return undefined;
			}
			switch (op1.size) {
				case 1:
					b = ctx.regs.ax.get();
					q = (b / a) | 0;
					if (q > 0xFF) {
						ctx.errorOccurred = true;
						ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
						return undefined;
					}
					ctx.regs.al.set(q);
					ctx.regs.ah.set(b % a);
					break;
				case 2:
					tmp[0] = (ctx.regs.dx.get() << 16);
					tmp[0] |= ctx.regs.ax.get();
					q = (tmp[0] / a) | 0;
					if (q > 0xFFFF) {
						ctx.errorOccurred = true;
						ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
						return undefined;
					}
					ctx.regs.ax.set(q);
					ctx.regs.dx.set(tmp[0] % a);
					break;
				case 4:
					b = ctx.regs.edx.get();
					bl = ctx.regs.eax.get();
					if (b) {
						//must be optimized one day...
						q = 0;
						r = 0;
						for (i = 31; i >= 0; i--) {
							r = r << 1;
							r |= (b >>> i) & 1;
							if (r >= a) {
								ctx.errorOccurred = true;
								ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
								return undefined;
							}
						}
						for (i = 31; i >= 0; i--) {
							r = r << 1;
							r |= (bl >>> i) & 1;
							if (r >= a) {
								r = r - a;
								q |= (1 << i);
							}
						}
						ctx.regs.eax.set(q);
						ctx.regs.edx.set(r);
					} else {
						ctx.regs.eax.set((bl / a) | 0);
						ctx.regs.edx.set(bl % a);
					}
					break;
			}
			return undefined;
		}
	},
	idiv: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validate1op,
		exec: function (ctx, op1) {
			//AF FLAG
			var a = op1.get(), i, b, bl, q, r, tmp = ctx.tmp4Byte, negB, negA;
			if (ctx.errorOccurred) return undefined;
			if (!a) {
				ctx.errorOccurred = true;
				ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_BY_0);
				return undefined;
			}
			switch (op1.size) {
				case 1:
					//sign extend
					tmp.setInt8(0, a);
					a = tmp.getInt8(0);
					tmp.setInt16(0, ctx.regs.ax.get());
					b = tmp.getInt16(0);
					q = (b / a) | 0;
					if (q > 0x7F || q < -0x80) {
						ctx.errorOccurred = true;
						ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
						return undefined;
					}
					ctx.regs.al.set(q);
					ctx.regs.ah.set(b % a);
					break;
				case 2:
					tmp.setInt16(0, a);
					a = tmp.getInt16(0);
					tmp.setUint16(2, ctx.regs.dx.get(), true);
					tmp.setUint16(0, ctx.regs.ax.get(), true);
					b = tmp.getInt32(0, true);
					q = (b / a) | 0;
					if (q > 0x7FFF || q < -0x8000) {
						ctx.errorOccurred = true;
						ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
						return undefined;
					}
					ctx.regs.ax.set(q);
					ctx.regs.dx.set(b % a);
					break;
				case 4:
					b = ctx.regs.edx.get();
					bl = ctx.regs.eax.get();
					if (b && b !== 0xFFFFFFFF) {
						//there is a nice workaround here (or "gambiarra" in portuguese), involving "negA" and "negB", to deal with the signs...
						if (a >= 0x80000000) {
							negA = 1;
							a = (~a) + 1; //2's complement
						} else {
							negA = 0;
						}
						if (b >= 0x80000000) {
							negB = 1;
							ctx.uint32Tmp[0] = bl;
							tmp.setUint32(0, ~ctx.uint32Tmp[0] + 1); //2's complement
							bl = tmp.getUint32(0);
							tmp.setUint32(0, ~b + (ctx.uint32Tmp[0] ? 0 : 1));
							b = tmp.getUint32(0);
						} else {
							negB = 0;
						}
						//must be optimized one day...
						q = 0;
						r = 0;
						for (i = 31; i >= 0; i--) {
							r = r << 1;
							r |= (b >>> i) & 1;
							if (r >= a) {
								ctx.errorOccurred = true;
								ctx.errorNotificationFunction(Asm86Emulator.prototype.MESSAGES.DIVISION_OVERFLOW);
								return undefined;
							}
						}
						for (i = 31; i >= 0; i--) {
							r = r << 1;
							r |= (bl >>> i) & 1;
							if (r >= a) {
								r = r - a;
								q |= (1 << i);
							}
						}
						ctx.regs.eax.set((negA ^ negB) ? -q : q);
						ctx.regs.edx.set(negB ? -r : r);
					} else {
						tmp.setInt32(0, a);
						a = tmp.getInt32(0);
						tmp.setInt32(0, bl);
						bl = tmp.getInt32(0);
						ctx.regs.eax.set((bl / a) | 0);
						ctx.regs.edx.set(bl % a);
					}
					break;
			}
			return undefined;
		}
	},
	rdrand: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG, //16 or 32 bits only!
		validate: function (op1, op2) {
			var r = Asm86Emulator.prototype._validate.call(this, op1, op2);
			if (r) return r;
			if (op1.size !== 2 && op1.size !== 4) return Asm86Emulator.prototype.MESSAGES.DST16_32_ONLY;
			return null;
		},
		exec: function (ctx, op1) {
			//AF FLAG
			ctx.flagCarry = 1;
			ctx.flagOv = 0;
			ctx.flagZ = 0;
			ctx.flagSign = 0;
			op1.set(0xFFFFFFFF * Math.random());
		}
	},
	cmovz: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagZ)
				op1.set(s);
			return undefined;
		}
	},
	cmovnz: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && !ctx.flagZ)
				op1.set(s);
			return undefined;
		}
	},
	cmovae: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && !ctx.flagCarry)
				op1.set(s);
			return undefined;
		}
	},
	cmova: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && !ctx.flagCarry && !ctx.flagZ)
				op1.set(s);
			return undefined;
		}
	},
	cmovbe: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && (ctx.flagCarry || ctx.flagZ))
				op1.set(s);
			return undefined;
		}
	},
	cmovb: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagCarry)
				op1.set(s);
			return undefined;
		}
	},
	cmovge: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagSign === ctx.flagOv)
				op1.set(s);
			return undefined;
		}
	},
	cmovg: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagSign === ctx.flagOv && !ctx.flagZ)
				op1.set(s);
			return undefined;
		}
	},
	cmovle: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && (ctx.flagSign !== ctx.flagOv || ctx.flagZ))
				op1.set(s);
			return undefined;
		}
	},
	cmovl: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagSign !== ctx.flagOv)
				op1.set(s);
			return undefined;
		}
	},
	cmovs: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagSign)
				op1.set(s);
			return undefined;
		}
	},
	cmovns: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && !ctx.flagSign)
				op1.set(s);
			return undefined;
		}
	},
	cmovo: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && ctx.flagOv)
				op1.set(s);
			return undefined;
		}
	},
	cmovno: {
		operandCount: 2,
		op1Type: Asm86Emulator.prototype.TYPE_REG,
		op2Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateCMOV,
		exec: function (ctx, op1, op2) {
			var s;
			if ((s = op2.get()) !== null && !ctx.flagOv)
				op1.set(s);
			return undefined;
		}
	},
	setz: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(ctx.flagZ ? 1 : 0);
		}
	},
	setnz: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(!ctx.flagZ ? 1 : 0);
		}
	},
	setae: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(!ctx.flagCarry ? 1 : 0);
		}
	},
	seta: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((!ctx.flagCarry && !ctx.flagZ) ? 1 : 0);
		}
	},
	setbe: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((ctx.flagCarry || ctx.flagZ) ? 1 : 0);
		}
	},
	setb: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(ctx.flagCarry ? 1 : 0);
		}
	},
	setge: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((ctx.flagSign === ctx.flagOv) ? 1 : 0);
		}
	},
	setg: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((ctx.flagSign === ctx.flagOv && !ctx.flagZ) ? 1 : 0);
		}
	},
	setle: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((ctx.flagSign !== ctx.flagOv || ctx.flagZ) ? 1 : 0);
		}
	},
	setl: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set((ctx.flagSign !== ctx.flagOv) ? 1 : 0);
		}
	},
	sets: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(ctx.flagSign ? 1 : 0);
		}
	},
	setns: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(!ctx.flagSign ? 1 : 0);
		}
	},
	seto: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(ctx.flagOv ? 1 : 0);
		}
	},
	setno: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_REG | Asm86Emulator.prototype.TYPE_MEM,
		validate: Asm86Emulator.prototype._validateSET,
		exec: function (ctx, op1) {
			return op1.set(!ctx.flagOv ? 1 : 0);
		}
	},
	xsave: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_MEM, //this instruction is FAR from the documentation... it requires an address pointing to at least 36 bytes
		validate: Asm86Emulator.prototype._validateXSR,
		exec: function (ctx, op1) {
			var a = op1.getAddress();
			if (ctx.setMem(a, ctx.regs.eax.get(), 4) && ctx.setMem(a + (8 << 2), ctx.getFlags(), 4)) {
				ctx.setMem(a + (1 << 2), ctx.regs.ebx.get(), 4);
				ctx.setMem(a + (2 << 2), ctx.regs.ecx.get(), 4);
				ctx.setMem(a + (3 << 2), ctx.regs.edx.get(), 4);
				ctx.setMem(a + (4 << 2), ctx.regs.esi.get(), 4);
				ctx.setMem(a + (5 << 2), ctx.regs.edi.get(), 4);
				ctx.setMem(a + (6 << 2), ctx.regs.ebp.get(), 4);
				ctx.setMem(a + (7 << 2), ctx.regs.esp.get(), 4);
			}
			return undefined;
		}
	},
	xrstor: {
		operandCount: 1,
		op1Type: Asm86Emulator.prototype.TYPE_MEM, //this instruction is FAR from the documentation... it requires an address pointing to at least 36 bytes
		validate: Asm86Emulator.prototype._validateXSR,
		exec: function (ctx, op1) {
			var a = op1.getAddress(), tmpa, tmpf;
			if ((tmpa = ctx.getMem(a, 4)) !== null && (tmpf = ctx.getMem(a + (8 << 2), 4)) !== null) {
				ctx.regs.eax.set(tmpa);
				ctx.regs.ebx.set(ctx.getMem(a + (1 << 2), 4));
				ctx.regs.ecx.set(ctx.getMem(a + (2 << 2), 4));
				ctx.regs.edx.set(ctx.getMem(a + (3 << 2), 4));
				ctx.regs.esi.set(ctx.getMem(a + (4 << 2), 4));
				ctx.regs.edi.set(ctx.getMem(a + (5 << 2), 4));
				ctx.regs.ebp.set(ctx.getMem(a + (6 << 2), 4));
				ctx.regs.esp.set(ctx.getMem(a + (7 << 2), 4));
				ctx.setFlags(tmpf);
			}
			return undefined;
		}
	}
};
Asm86Emulator.prototype.OP.cmove = Asm86Emulator.prototype.OP.cmovz;
Asm86Emulator.prototype.OP.cmovne = Asm86Emulator.prototype.OP.cmovnz;
Asm86Emulator.prototype.OP.cmovnb = Asm86Emulator.prototype.OP.cmovae;
Asm86Emulator.prototype.OP.cmovnbe = Asm86Emulator.prototype.OP.cmova;
Asm86Emulator.prototype.OP.cmovna = Asm86Emulator.prototype.OP.cmovbe;
Asm86Emulator.prototype.OP.cmovnae = Asm86Emulator.prototype.OP.cmovb;
Asm86Emulator.prototype.OP.cmovnl = Asm86Emulator.prototype.OP.cmovge;
Asm86Emulator.prototype.OP.cmovnle = Asm86Emulator.prototype.OP.cmovg;
Asm86Emulator.prototype.OP.cmovng = Asm86Emulator.prototype.OP.cmovle;
Asm86Emulator.prototype.OP.cmovnge = Asm86Emulator.prototype.OP.cmovl;
Asm86Emulator.prototype.OP.cmovc = Asm86Emulator.prototype.OP.cmovb;
Asm86Emulator.prototype.OP.cmovnc = Asm86Emulator.prototype.OP.cmovae;
Asm86Emulator.prototype.OP.je = Asm86Emulator.prototype.OP.jz;
Asm86Emulator.prototype.OP.jne = Asm86Emulator.prototype.OP.jnz;
Asm86Emulator.prototype.OP.jnb = Asm86Emulator.prototype.OP.jae;
Asm86Emulator.prototype.OP.jnbe = Asm86Emulator.prototype.OP.ja;
Asm86Emulator.prototype.OP.jna = Asm86Emulator.prototype.OP.jbe;
Asm86Emulator.prototype.OP.jnae = Asm86Emulator.prototype.OP.jb;
Asm86Emulator.prototype.OP.jnl = Asm86Emulator.prototype.OP.jge;
Asm86Emulator.prototype.OP.jnle = Asm86Emulator.prototype.OP.jg;
Asm86Emulator.prototype.OP.jng = Asm86Emulator.prototype.OP.jle;
Asm86Emulator.prototype.OP.jnge = Asm86Emulator.prototype.OP.jl;
Asm86Emulator.prototype.OP.jc = Asm86Emulator.prototype.OP.jb;
Asm86Emulator.prototype.OP.jnc = Asm86Emulator.prototype.OP.jae;
Asm86Emulator.prototype.OP.sete = Asm86Emulator.prototype.OP.setz;
Asm86Emulator.prototype.OP.setne = Asm86Emulator.prototype.OP.setnz;
Asm86Emulator.prototype.OP.setnb = Asm86Emulator.prototype.OP.setae;
Asm86Emulator.prototype.OP.setnbe = Asm86Emulator.prototype.OP.seta;
Asm86Emulator.prototype.OP.setna = Asm86Emulator.prototype.OP.setbe;
Asm86Emulator.prototype.OP.setnae = Asm86Emulator.prototype.OP.setb;
Asm86Emulator.prototype.OP.setnl = Asm86Emulator.prototype.OP.setge;
Asm86Emulator.prototype.OP.setnle = Asm86Emulator.prototype.OP.setg;
Asm86Emulator.prototype.OP.setng = Asm86Emulator.prototype.OP.setle;
Asm86Emulator.prototype.OP.setnge = Asm86Emulator.prototype.OP.setl;
Asm86Emulator.prototype.OP.setc = Asm86Emulator.prototype.OP.setb;
Asm86Emulator.prototype.OP.setnc = Asm86Emulator.prototype.OP.setae;
Asm86Emulator.prototype.OP.loopz = Asm86Emulator.prototype.OP.loope;
Asm86Emulator.prototype.OP.loopnz = Asm86Emulator.prototype.OP.loopne;
Asm86Emulator.prototype.OP.sal = Asm86Emulator.prototype.OP.shl;
for (var op in Asm86Emulator.prototype.OP) Object.freeze(Asm86Emulator.prototype.OP[op]);
Object.seal(Asm86Emulator.prototype.MESSAGES); //seal, do not freeze, so it can be translated
Object.freeze(Asm86Emulator.prototype.OP);
Object.freeze(Asm86Emulator.prototype);
