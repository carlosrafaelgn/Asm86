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
var Asm86Language = {
	translate: function (messages, ui) {
		var k, m;
		for (k in Asm86Emulator.prototype.MESSAGES) {
			m = messages[k];
			if (m && m.length > 0) Asm86Emulator.prototype.MESSAGES[k] = m;
		}
		for (k in Asm86UI) {
			m = ui[k];
			if (m && m.length > 0) Asm86UI[k] = m;
		}
		return true;
	},
	enMessages: {
		INVALID_OP_COUNT: "Invalid operand count",
		INVALID_DST_TYPE: "Invalid destination operand type",
		INVALID_SRC_TYPE: "Invalid source operand type",
		MEM_MEM_NOT_ALLOWED: "It is not allowed to have both source and destination operands accessing the memory at the same time",
		AL_AX_EAX_ONLY: "The first operand must be one of the following registers: AL, AX ou EAX",
		AL_AX_EAX_ONLY_2: "The second operand must be one of the following registers: AL, AX ou EAX",
		CL_ONLY: "The second operand must be either an immediate value or the CL register",
		DX_ONLY: "The first operand must be either an immediate value or the DX register",
		DX_ONLY_2: "The second operand must be either an immediate value or the DX register",
		IMM_BETWEEN_0_255: "The immediate value must be between 0 and 255",
		INVALID_INTERRUPT: "The interrupt number must be 3, or it must be between 32 and 255",
		DST16_32_ONLY: "It is only allowed to use 16 or 32 bit registers as the destination operand",
		SRC16_32_ONLY: "It is only allowed to use 16 or 32 bit registers as the source operand",
		ANY_DST8_16_32_ONLY: "It is only allowed to use 8, 16 or 32 bit destination operands",
		ANY_SRC8_16_32_ONLY: "It is only allowed to use 8, 16 or 32 bit source operands",
		ANY_DST8_ONLY: "It is only allowed to use 8 bit destination operands",
		ANY_DST16_32_ONLY: "It is only allowed to use 16 or 32 bit destination operands",
		NO_EIP: "It is not possible to access EIP register directly",
		REG32_ONLY: "It is only allowed to use 32 bit registers as the destination operand",
		DST_SRC_SIZE_MISMATCH: "Mismatch in source and destination operand sizes",
		DST_SRC_SIZE_UNKNOWN: "The size of both source and destination operands are unknown",
		DST_SIZE_UNKNOWN: "Unknown destination operand size",
		SRC_SIZE_UNKNOWN: "Unknown source operand size",
		INVALID_READ_ADDRESS: "Invalid reading address: ",
		INVALID_READ_SIZE: "Invalid reading size: ",
		INVALID_WRITE_ADDRESS: "Invalid writing address: ",
		INVALID_WRITE_SIZE: "Invalid writing size: ",
		INVALID_INSTRUCTION_ADDRESS: "Invalid instruction address: ",
		DIVISION_BY_0: "Division by 0",
		DIVISION_OVERFLOW: "Division quotient overflow",
		DUPLICATE_LABEL: "Repeated label name: ",
		DUPLICATE_VARIABLE: "Repeated variable name: ",
		INVALID_VARIABLE_SIZE: "Invalid variable size: ",
		INVALID_VARIABLE_NAME: "Invalid variable name: ",
		UNKNOWN_LABEL: "Unknown label name: ",
		UNKNOWN_OPERATOR: "Unknown operator: ",
		LABEL_OR_OPERATOR_EXPECTED: "Label or operator expected",
		OPERATOR_EXPECTED_AFTER_PREFIX: "Operador expected after prefix",
		OPERATOR_CANNOT_HAVE_PREFIX: "This operator cannot be used with a prefix",
		OPERAND_EXPECTED: "Operand expected",
		COLON_EXPECTED: "Incomplete label definition: character \":\" expected",
		COMMA_EXPECTED: "Character \",\" expected",
		UNKNOWN_VARIABLE: "Unknown variable name: ",
		NOT_ENOUGH_SPACE: "The amount of memory required by the variables exceeds memory capacity: ",
		PTR_EXPECTED: "Invalid memory expression: \"ptr\" expected",
		SQBRACKET_EXPECTED: "Invalid memory expression: character \"[\" expected",
		INVALID_MEMORY_REF_FORMAT: "Invalid memory expression format",
		INVALID_SCALE: "Register scale must be 1, 2, 4 or 8",
		INVALID_NUMBER: "Invalid number",
		VALUE_OUT_OF_RANGE: "Value out of range",
		INVALID_CHAR: "Invalid character: "
	},
	enUI: {
		TITLE: "Assembly x86 Emulator",
		RUN: "Run",
		RUNNING: "Running...",
		PAUSE: "Pause",
		STEP: "Step",
		STEPPING: "Running one step...",
		RESET: "Reset",
		COMPILE: "Compile",
		WINDOWS: "Windows",
		ABOUT: "About",
		LOAD_FILE: "Load file",
		SAVE_FILE: "Save file",
		CLOSE: "Close",
		CLOSE_MSG: "Close message",
		ADD: "Add",
		CANCEL: "Cancel",
		OK: "OK",
		VARIABLES: "Variables",
		REGISTERS: "Registers",
		EEPROM: "EEPROM",
		HARDWARE: "Hardware",
		CONSOLE: "Console",
		SHADOW: "Window shadows",
		NOCODE: "No code",
		LINE: "Ln",
		COLUMN: "Col",
		NAME: "Name",
		SIZE: "Size",
		VALUE: "Value",
		ADDR: "Address",
		SORT_BY_NAME: "Sort by name",
		SORT_BY_SIZE: "Sort by size",
		SORT_BY_ADDR: "Sort by address",
		ADD_VAR: "Add...",
		ADD_VAR_TITLE: "Add Variable",
		REM_VAR: "Remove variable",
		PROCESSOR_IO: "The processor is waiting for the completion of an IO operation",
		PROCESSOR_INT: "The processor is waiting for an external interrupt",
		EMU_RESET: "Emulation reset!",
		EMU_ENDED: "Emulation ended successfully!",
		IMPOSSIBLE_ADD_VAR: "It is not possible to add variables during runtime!",
		IMPOSSIBLE_REM_VAR: "It is not possible to remove variables during runtime!",
		CONFIRM_REM_VAR: "Do you really want to remove the variable",
		INITIAL_VALUE: "Initial value",
		ARRAY_WITH_LENGTH: "Array (length)",
		ARRAY_WITH_BYTES: "Array (bytes)",
		ARRAY_WITH_TEXT: "Array (text)",
		ARRAY_HINT: "Enter the elements separated by commas \",\"",
		ARRAY_TEXT_HINT: "Use %t for tabulation or %n for line breaks",
		INVALID_INITIAL_VALUE: "Invalid initial value: ",
		INVALID_INITIAL_CONTENTS: "Invalid initial contents: ",
		INVALID_ELEMENT: "Invalid element: ",
		EMPTY_INITIAL_TEXT: "Empty initial text!",
		PENDING_EXECUTION: "It is not possible to proceed while there is a pending execution",
		PENDING_IO: "It is not possible to proceed because the processor is waiting for the completion of an IO operation",
		PENDING_INT: "It is not possible to proceed bacause the processor is waiting for an external interrupt",
		COMPILED: "Compiled successfully!",
		NO_FILE_API: "Aparently your browser does not offer the API required to access local files! :(",
		FILE_ACCESS_ERROR: "An error has occurred while trying to access the file: ",
		FILE_ACCESS_HINT: "This might have happened due to browser permissions. Possible corrections are:<br />- Access the page through a web server instead of accessing it locally<br />- If you are using Chrome, run it with the option --allow-file-access-from-files<br />- Use other browsers like Firefox or Opera",
		EMPTY_FILE: "Empty file: ",
		UNKNOWN_FILE_FORMAT: "Unknown file format: ",
		INVALID_FILE_FORMAT: "Invalid file format: ",
		NOT_UPDATED: "Not updated during runtime",
		LOAD_EXAMPLE: "Load example",
		SAMPLE_INFO: "Choose one test:\n\n\t1 - Timer, interrupts and lighting test\n\t2 - Buttons and lighting test (0 finishes the test)\n\t3 - Random lighting test (0 finishes, 1 pauses the test)\n\n\n*** Use the hardware buttons ***",
		SAMPLE_INFO2: "                              Feature demonstration                             ",
		SAMPLE_ERROR: "An error occurred while downloading the example: ",
		LANGUAGE: "Language"
	}
},
Asm86UI = {
	TITLE: "Emulador Assembly x86",
	RUN: "Executar",
	RUNNING: "Executando...",
	PAUSE: "Pausar",
	STEP: "Passo",
	STEPPING: "Executando um passo...",
	RESET: "Reset",
	COMPILE: "Compilar",
	WINDOWS: "Janelas",
	ABOUT: "Sobre",
	LOAD_FILE: "Abrir arquivo",
	SAVE_FILE: "Salvar arquivo",
	CLOSE: "Fechar",
	CLOSE_MSG: "Fechar mensagem",
	ADD: "Adicionar",
	CANCEL: "Cancelar",
	OK: "OK",
	VARIABLES: "Variáveis",
	REGISTERS: "Registradores",
	EEPROM: "EEPROM",
	HARDWARE: "Hardware",
	CONSOLE: "Console",
	SHADOW: "Sombra nas janelas",
	NOCODE: "Sem código",
	LINE: "Ln",
	COLUMN: "Col",
	NAME: "Nome",
	SIZE: "Tam.",
	VALUE: "Valor",
	ADDR: "Endereço",
	SORT_BY_NAME: "Ordenar por nome",
	SORT_BY_SIZE: "Ordenar por tamanho",
	SORT_BY_ADDR: "Ordenar por endereço",
	ADD_VAR: "Adicionar...",
	ADD_VAR_TITLE: "Adicionar Variável",
	REM_VAR: "Remover variável",
	PROCESSOR_IO: "O processador está aguardando pelo término de uma operação de IO",
	PROCESSOR_INT: "O processador está aguardando por uma interrupção externa",
	EMU_RESET: "Emulação reiniciada!",
	EMU_ENDED: "Execução encerrada com sucesso!",
	IMPOSSIBLE_ADD_VAR: "Impossível adicionar variáveis durante a execução do programa!",
	IMPOSSIBLE_REM_VAR: "Impossível remover variáveis durante a execução do programa!",
	CONFIRM_REM_VAR: "Deseja mesmo remover a variável",
	INITIAL_VALUE: "Valor inicial",
	ARRAY_WITH_LENGTH: "Array (comprimento)",
	ARRAY_WITH_BYTES: "Array (bytes)",
	ARRAY_WITH_TEXT: "Array (texto)",
	ARRAY_HINT: "Entre com os elementos separados por vírgulas \",\"",
	ARRAY_TEXT_HINT: "Utilize %t para tabulação, ou %n para quebra de linha",
	INVALID_INITIAL_VALUE: "Valor inicial inválido: ",
	INVALID_INITIAL_CONTENTS: "Conteúdo inicial inválido: ",
	INVALID_ELEMENT: "Elemento inválido: ",
	EMPTY_INITIAL_TEXT: "Texto inicial vazio!",
	PENDING_EXECUTION: "Não é possível prosseguir enquanto houver uma execução ainda pendente",
	PENDING_IO: "Não é possível prosseguir, pois o processador está aguardando pelo término de uma operação de IO",
	PENDING_INT: "Não é possível prosseguir, pois o processador está aguardando por uma interrupção externa",
	COMPILED: "Compilado com sucesso!",
	NO_FILE_API: "Aparentemente seu browser não possui a API necessária para acessar arquivos locais! :(",
	FILE_ACCESS_ERROR: "Ocorreu um erro ao tentar acessar o arquivo: ",
	FILE_ACCESS_HINT: "Isso pode ter ocorrido devido a permissões do browser. Possíveis correções são:<br />- Acessar essa página através de um servidor web, em vez de acessar o arquivo localmente<br />- Se você estiver utilizando o Chrome, execute o browser com a opção --allow-file-access-from-files<br />- Utilize outros browsers, como Firefox ou Opera",
	EMPTY_FILE: "Arquivo vazio: ",
	UNKNOWN_FILE_FORMAT: "Formato de arquivo desconhecido: ",
	INVALID_FILE_FORMAT: "Formato de arquivo inválido: ",
	NOT_UPDATED: "Não atualizado durante a execução",
	LOAD_EXAMPLE: "Abrir exemplo",
	SAMPLE_INFO: "Escolha um teste:\n\n\t1 - Teste de timers, interrupções e iluminação\n\t2 - Teste de botões e iluminação (0 termina o teste)\n\t3 - Teste de iluminação aleatória (0 termina, 1 pausa o teste)\n\n\n*** Utilize os botões de hardware ***",
	SAMPLE_INFO2: "                         Demonstração de funcionalidade                         ",
	SAMPLE_ERROR: "Ocorreu um erro durante o download do exemplo: ",
	LANGUAGE: "Idioma"
};
Object.freeze(Asm86Language.enMessages);
Object.freeze(Asm86Language.enUI);
Object.freeze(Asm86Language);
Object.seal(Asm86UI);
