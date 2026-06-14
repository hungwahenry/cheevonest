import { ApiException } from '../../../../common/exceptions/api.exception';

export class CommandNotAllowedException extends ApiException {
  constructor(command: string) {
    super(
      `'${command}' is not a runnable maintenance command.`,
      422,
      {},
      'command_not_allowed',
    );
  }
}
