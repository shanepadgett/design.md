import { agentSpec, humanSpec } from "../../core/spec/spec-content.js";
import type { SpecCommand } from "../args.js";
import type { CommandIO } from "../io.js";

export type SpecCommandIO = Pick<CommandIO, "stdout">;

export async function runSpecCommand(command: SpecCommand, io: SpecCommandIO): Promise<number> {
  io.stdout.write(command.agent ? agentSpec : humanSpec);
  return 0;
}
