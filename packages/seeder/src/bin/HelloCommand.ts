import {Command, CommandProvider, QuestionOptions} from "@tsed/cli-core";

export interface HelloCommandContext {
}

@Command({
  name: "hello-command",
  description: "Command description",
  args: {
  },
  options: {
  },
  allowUnknownOption: false
})
export class HelloCommand implements CommandProvider {
  /**
   *  Ask questions with Inquirer. Return an empty array or don't implement the method to skip this step
   */
  async $prompt(initialOptions: Partial<HelloCommandContext>): Promise<QuestionOptions> {
    return [];
  }

  /**
   * This method is called after the $prompt to create / map inputs to a proper context for the next step
   */
  $mapContext(ctx: Partial<HelloCommandContext>): HelloCommandContext {
    return {
      ...ctx
      // map something, based on ctx
    };
  }
  /**
   *  This step run your tasks with Listr module
   */
  async $exec(ctx: HelloCommandContext): Promise<any> {
    return [
      {
        title: "Do something",
        task: () => {
          console.log('HELLO')
        }
      }
    ];
  }
}
