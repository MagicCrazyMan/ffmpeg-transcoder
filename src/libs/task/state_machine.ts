import dayjs from "dayjs";
import { v4 } from "uuid";
import { Task, TaskData } from ".";
import { useAppStore } from "../../store/app";
import { useHistoryStore } from "../../store/history";
import { useTaskStore } from "../../store/task";
import { pauseTask, resumeTask, startTask, stopTask } from "../../tauri/task";
import { TaskMessageRunning } from "./message";

export enum TaskStateCode {
  Idle,
  Running,
  Queueing,
  Pausing,
  Stopped,
  Finished,
  Errored,
}

export abstract class TaskState {
  public abstract readonly code: TaskStateCode;

  public abstract readonly startable: boolean;

  public abstract readonly pauseable: boolean;

  public abstract readonly stoppable: boolean;

  public abstract readonly editable: boolean;

  public abstract readonly removable: boolean;

  public abstract readonly resetable: boolean;

  public abstract start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }>;

  public abstract pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }>;

  public abstract stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }>;

  public abstract finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }>;

  public async error(
    task: Task,
    reason: string
  ): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.error(reason);
    return {
      nextState: new Errored(reason),
      nextData: task.data,
    };
  }
}

/**
 * Determines whether length of current running tasks
 * larger than or equals the max running count limitation.
 */
const isOverflow = () => {
  const { configuration } = useAppStore.getState();
  const { tasks } = useTaskStore.getState();

  const currentRunning = tasks.filter((task) => task.state.code === TaskStateCode.Running).length;

  return currentRunning >= configuration.maxRunning;
};

/**
 * Idle state
 */
export class Idle extends TaskState {
  public readonly code = TaskStateCode.Idle;
  public readonly startable = true;
  public readonly pauseable = false;
  public readonly stoppable = false;
  public readonly editable = true;
  public readonly removable = true;
  public readonly resetable = false;

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    if (isOverflow()) {
      return {
        nextState: new Queueing(this),
        nextData: task.data,
      };
    }

    try {
      await startTask(task.id, task.data.args);

      useHistoryStore.getState().addHistoryTasks({
        id: v4(),
        creationTime: task.data.creationTime,
        args: task.data.args,
      });

      return {
        nextState: new Running(),
        nextData: {
          ...task.data,
          durations: [...task.data.durations, [dayjs(), undefined]],
        },
      };
    } catch (err) {
      return {
        nextState: new Errored(err as string),
        nextData: task.data,
      };
    }
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return {
      nextState: new Idle(),
      nextData: task.data,
    };
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return {
      nextState: new Stopped(),
      nextData: task.data,
    };
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a idle task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}

/**
 * Queueing state
 */
export class Queueing extends TaskState {
  public readonly code = TaskStateCode.Queueing;
  public readonly startable = false;
  public readonly pauseable = true;
  public readonly stoppable = true;
  public readonly editable = false;
  public readonly removable = false;
  public readonly resetable = false;

  public readonly previousState: Idle | Pausing;

  constructor(previousState: Idle | Pausing) {
    super();
    this.previousState = previousState;
  }

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return this.previousState.start(task);
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return this.previousState.pause(task);
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return this.previousState.stop(task);
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a queueing task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}

/**
 * Running state
 */
export class Running extends TaskState {
  public readonly code = TaskStateCode.Running;
  public readonly startable = false;
  public readonly pauseable = true;
  public readonly stoppable = true;
  public readonly editable = false;
  public readonly removable = false;
  public readonly resetable = false;

  public lastMessage?: TaskMessageRunning;

  constructor(lastMessage?: TaskMessageRunning) {
    super();
    this.lastMessage = lastMessage;
  }

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to start a running task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    try {
      await pauseTask(task.id);
      return {
        nextState: new Pausing(this.lastMessage),
        nextData: {
          ...task.data,
          durations: task.data.durations.map((duration, index, arr) => {
            if (index < arr.length - 1) {
              return duration;
            } else {
              return [duration[0], dayjs()];
            }
          }),
        },
      };
    } catch (err) {
      return {
        nextState: new Errored(err as string),
        nextData: task.data,
      };
    }
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    try {
      await stopTask(task.id);
      return {
        nextState: new Stopped(),
        nextData: {
          ...task.data,
          durations: task.data.durations.map((duration, index, arr) => {
            if (index < arr.length - 1) {
              return duration;
            } else {
              return [duration[0], dayjs()];
            }
          }),
        },
      };
    } catch (err) {
      return {
        nextState: new Errored(err as string),
        nextData: task.data,
      };
    }
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    return {
      nextState: new Finished(),
      nextData: task.data,
    };
  }
}

/**
 * Pausing state
 */
export class Pausing extends TaskState {
  public readonly code = TaskStateCode.Pausing;
  public readonly startable = true;
  public readonly pauseable = false;
  public readonly stoppable = true;
  public readonly editable = false;
  public readonly removable = false;
  public readonly resetable = false;

  public lastMessage?: TaskMessageRunning;

  constructor(lastMessage?: TaskMessageRunning) {
    super();
    this.lastMessage = lastMessage;
  }

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    if (isOverflow()) {
      return {
        nextState: new Queueing(this),
        nextData: task.data,
      };
    }

    try {
      await resumeTask(task.id);
      return {
        nextState: new Running(this.lastMessage),
        nextData: {
          ...task.data,
          durations: [...task.data.durations, [dayjs(), undefined]],
        },
      };
    } catch (err) {
      return {
        nextState: new Errored(err as string),
        nextData: task.data,
      };
    }
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to pause a pausing task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    try {
      await stopTask(task.id);
      return {
        nextState: new Stopped(),
        nextData: task.data,
      };
    } catch (err) {
      return {
        nextState: new Errored(err as string),
        nextData: task.data,
      };
    }
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a pausing task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}

/**
 * Stopped state
 */
export class Stopped extends TaskState {
  public readonly code = TaskStateCode.Stopped;
  public readonly startable = false;
  public readonly pauseable = false;
  public readonly stoppable = false;
  public readonly editable = false;
  public readonly removable = true;
  public readonly resetable = true;

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to start a stopped task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to pause a stopped task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to stop a stopped task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a stopped task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}

/**
 * Errored state
 */
export class Errored extends TaskState {
  public readonly code = TaskStateCode.Errored;
  public readonly startable = false;
  public readonly pauseable = false;
  public readonly stoppable = false;
  public readonly editable = false;
  public readonly removable = true;
  public readonly resetable = true;

  public readonly reason: string;

  constructor(reason: string) {
    super();
    this.reason = reason;
  }

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to start a errored task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to pause a errored task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to stop a errored task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a errored task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}

/**
 * Finished state
 */
export class Finished extends TaskState {
  public readonly code = TaskStateCode.Finished;
  public readonly startable = false;
  public readonly pauseable = false;
  public readonly stoppable = false;
  public readonly editable = false;
  public readonly removable = true;
  public readonly resetable = true;

  public async start(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to start a finished task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async pause(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to pause a finished task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async stop(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to stop a finished task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }

  public async finish(task: Task): Promise<{ nextState: TaskState; nextData: TaskData }> {
    console.warn("Attempting to finish a finished task");
    return {
      nextState: this,
      nextData: task.data,
    };
  }
}
