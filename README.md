Asm86
=====

This is a JavaScript assembly x86 compiler and emulator for educational purposes. I use it in my classes on Computer Architecture.

The project site, http://carlosrafaelgn.com.br/Asm86, can be used as an example (in Portuguese). It uses CodeMirror (http://codemirror.net) as the code editor.

The script adds only three names to the global namespace: Asm86EmulatorContext, Asm86EmulatorCompiler and Asm86Emulator. However, creating instances of Asm86EmulatorContext and Asm86EmulatorCompiler will not be so usefull.

Limitations:
- Not all instructions have been implemented
- Not all flags have been implemented
- No segment/paging support
- Only 9 registers available (debug and control registers are not available)
- No task support as nowadays OSes implement (simple tasks can still be created using time-sharing algorithms)
- IO ports do not reflect the standard IO ports available in PC's
- No float point/MMX/SSE... instructions
- No advanced features like GDT, LDT
- IDT support is limited and does not reflect the original IDT description
- Instructions XSAVE and XRSTOR were changed and do not reflect the documented version
- Interrupts < 32, except for int 3, are not supported
- No instructions modifiers/prefixes, other than REP, have been implemented
- No 3 or more operands instructions have been implemented
- Not all CMOVcc/Jcc/SETcc instructions have been implemented
- Neither protected mode nor virtual mode has been implemented

I tried to be as faithful as possible to the manuals from Intel (although Volume 3 was not too much used):

Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume 1 - Basic Architecture (January 2013)
http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-1-manual.html
Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume 2 - Instruction Set Reference, A-Z (March 2012)
http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-2a-2b-instruction-set-a-z-manual.html
Intel® 64 and IA-32 Architectures Software Developer’s Manual Volume 3 - System Programming Guide (August 2012)
http://www.intel.com/content/www/us/en/architecture-and-technology/64-ia-32-architectures-software-developer-vol-3a-3b-system-programming-manual.html
