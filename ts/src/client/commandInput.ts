import { GlEvent, GlDef } from "./event";

import {AliasManager} from "./aliasManager";

export class CommandInput {
    private cmd_history: string[] = [];
    private cmd_index: number = -1;
    private cmd_entered: string = "";

    private $cmdInput: JQuery;
    private $cmdInputPw: JQuery;

    private chkCmdStack: HTMLInputElement;

    constructor(private aliasManager: AliasManager) {
        this.$cmdInput = $("#cmdInput");
        this.$cmdInputPw = $("#cmdInputPw");

        let cmdInputTextArea = this.$cmdInput[0] as HTMLTextAreaElement;
        cmdInputTextArea.rows = 2;
        let height2 = cmdInputTextArea.scrollHeight;
        cmdInputTextArea.rows = 3;
        this.pxPerLine = cmdInputTextArea.scrollHeight - height2; 

        cmdInputTextArea.rows = 1;
        cmdInputTextArea.style.height = Math.max(this.pxPerLine, 20) + "px";

        this.chkCmdStack = $("#chkCmdStack")[0] as HTMLInputElement;

        let divMoveInput = document.getElementsByClassName("divMoveInput")[0] as HTMLDivElement;
        divMoveInput.addEventListener("click", (ev: MouseEvent) => {
            this.moveInput();
        });
        this.$cmdInput.keydown((event: KeyboardEvent) => { return this.keydown(event); });
        this.$cmdInput.bind("input", () => { return this.inputChange(); });
        this.$cmdInputPw.keydown((event: KeyboardEvent) => { return this.pwKeydown(event); });

        GlEvent.setEcho.handle(this.handleSetEcho, this);
        GlEvent.telnetConnect.handle(this.handleTelnetConnect, this);

        $(document).ready(() => {
            this.loadHistory();
            this.inputChange();
        });
    }

    private echo: boolean = true;
    private handleSetEcho(value: GlDef.SetEchoData): void {
        this.echo = value;

        if (this.echo) {
            this.$cmdInputPw.hide();
            this.$cmdInput.show();
            this.$cmdInput.val("");
            this.inputChange();
            this.$cmdInput.focus();
        } else {
            this.$cmdInput.hide();
            this.$cmdInputPw.show();
            this.$cmdInputPw.focus();

            let current = this.$cmdInput.val();
            if (this.cmd_history.length > 0
                && current !== this.cmd_history[this.cmd_history.length - 1]) {
                /* If they already started typing password before getting echo command*/
                this.$cmdInputPw.val(current);
                (<HTMLInputElement>this.$cmdInputPw[0]).setSelectionRange(current.length, current.length);
            } else {
                this.$cmdInputPw.val("");
            }
        }
    }

    private handleTelnetConnect(): void {
        this.handleSetEcho(true);
    }

    private sendPw(): void {
        let pw = this.$cmdInputPw.val();
        GlEvent.sendPw.fire(pw);
    }

    private sendCmd(): void {
        let cmd: string = this.$cmdInput.val();
        let result = this.aliasManager.checkAlias(cmd);
        if (!result) {
            if (this.chkCmdStack.checked) {
                let cmds = cmd.split(";");
                for (let i = 0; i < cmds.length; i++) {
                    GlEvent.sendCommand.fire({value: cmds[i]});
                }
            } else {
                GlEvent.sendCommand.fire({value: cmd});
            }
        } else if (result !== true) {
            let cmds: string[] = [];
            let lines: string[] = (<string>result).replace("\r", "").split("\n");
            for (let i = 0; i < lines.length; i++) {
                cmds = cmds.concat(lines[i].split(";"));
            }
            GlEvent.aliasSendCommands.fire({orig: cmd, commands: cmds});
        } /* else the script ran already */

        this.$cmdInput.select();

        if (cmd.trim() === "") {
            return;
        }
        if (this.cmd_history.length > 0
            && cmd === this.cmd_history[this.cmd_history.length - 1]) {
            return;
        }

        if (this.echo) {
            this.cmd_history.push(cmd);
            this.cmd_history = this.cmd_history.slice(-20);
            this.saveHistory();
        }
        else {
            this.$cmdInput.val("");
            this.inputChange();
        }
        this.cmd_index = -1;
    };

    private pwKeydown(event: KeyboardEvent): boolean {
        switch (event.which) {
            case 13: // enter
                this.sendPw();
                this.$cmdInputPw.val("");
                return false;
            default:
                return true;
        }
    }

    private keydown(event: KeyboardEvent): boolean {
        switch (event.which) {
            case 97:
              GlEvent.sendCommand.fire({value: "southwest"})
              return false;
            case 98:
              GlEvent.sendCommand.fire({value: "south"});
              return false;
            case 99:
              GlEvent.sendCommand.fire({value: "southeast"});
              return false;
            case 100:
              GlEvent.sendCommand.fire({value: "west"});
              return false;
            case 101: // numpad 5
              GlEvent.sendCommand.fire({value: "look"});
              return false;
            case 102:
              GlEvent.sendCommand.fire({value: "east"});
              return false;
            case 103:
              GlEvent.sendCommand.fire({value: "northwest"});
              return false;
            case 104:
              GlEvent.sendCommand.fire({value: "north"});
              return false;
            case 105:
              GlEvent.sendCommand.fire({value: "northeast"});
              return false;
            case 106: // numpad *
              GlEvent.sendCommand.fire({value: "scan"});
              return false;
            case 107:
              GlEvent.sendCommand.fire({value: "down"});
              return false;
            case 109:
              GlEvent.sendCommand.fire({value: "up"});
              return false;
            case 111: // numpad /
              GlEvent.sendCommand.fire({value: "exits"})
              return false;
            case 13: // enter
                if (event.shiftKey) {
                    return true;
                } else {
                    this.sendCmd();
                    return false;
                }
            case 38: // up
                if (this.cmd_index === -1) {
                    this.cmd_entered = this.$cmdInput.val();
                    this.cmd_index = this.cmd_history.length - 1;
                } else {
                    this.cmd_index -= 1;
                    this.cmd_index = Math.max(this.cmd_index, 0);
                }
                this.$cmdInput.val(this.cmd_history[this.cmd_index]);
                this.inputChange();
                this.$cmdInput.select();
                return false;
            case 40: // down
                if (this.cmd_index === -1) {
                    break;
                }

                if (this.cmd_index === (this.cmd_history.length - 1)) {
                    // Already at latest, grab entered but unsent value
                    this.cmd_index = -1;
                    this.$cmdInput.val(this.cmd_entered);
                } else {
                    this.cmd_index += 1;
                    this.$cmdInput.val(this.cmd_history[this.cmd_index]);
                }
                this.inputChange();
                this.$cmdInput.select();
                return false;
            default:
                this.cmd_index = -1;
                return true;
        }
        return false;
    }

    private doInputChange: boolean = false;
    private inpLines: number = 0;
    private pxPerLine: number;

    private inputChange(): void {
        this.doInputChange = true;
        setTimeout(() => {
            if (this.doInputChange === false) {
                return;
            }
            let textArea = this.$cmdInput[0] as HTMLTextAreaElement;
            let txt = textArea.value;
            let lines = txt.split("\n");
            if (this.inpLines !== lines.length) {
                this.inpLines = lines.length;
                textArea.style.height = Math.max(this.inpLines * this.pxPerLine, 20) + "px";
            }
            this.doInputChange = false;
        }, 0);
    }

    private saveHistory(): void {
        localStorage.setItem("cmd_history", JSON.stringify(this.cmd_history));
    }

    private loadHistory(): void {
        let cmds = localStorage.getItem("cmd_history");
        if (cmds) {
            this.cmd_history = JSON.parse(cmds);
        }
    }

    private moveInput(): void {
        let leftPanel = document.getElementById("leftPanel");
        let cmdCont = document.getElementById("cmdCont");

        if (leftPanel.children[0] !== cmdCont) {
            $(leftPanel).prepend(cmdCont);
        } else {
            $(leftPanel).append(cmdCont);
        }
    }
}
