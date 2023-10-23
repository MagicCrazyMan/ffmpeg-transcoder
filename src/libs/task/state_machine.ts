import { v4 } from "uuid";
import { Task } from ".";
import { useAppStore } from "../../store/app";
import { useHistoryStore } from "../../store/history";
import { useTaskStore } from "../../store/task";
import { TauriError } from "../../tauri/error";
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

  public abstract start(task: Task): Promise<TaskState>;

  public abstract pause(task: Task): Promise<TaskState>;

  public abstract stop(task: Task): Promise<TaskState>;

  public abstract finish(task: Task): Promise<TaskState>;

  public async error(_task: Task, reason: TauriError): Promise<TaskState> {
    console.error(reason);
    return new Errored(reason);
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

  public async start(task: Task): Promise<TaskState> {
    if (isOverflow()) {
      return Promise.resolve(new Queueing(this));
    }

    try {
      await startTask(task.id, task.data.params);

      useHistoryStore.getState().addHistoryTasks({
        id: v4(),
        creationTime: task.data.creationTime,
        params: task.data.params,
      });

      return new Running();
    } catch (err) {
      return new Errored(err as TauriError);
    }
  }

  public async pause(): Promise<TaskState> {
    return new Idle();
  }

  public async stop(): Promise<TaskState> {
    return new Stopped();
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a idle task");
    return this;
  }
}

/**
 * Queueing state
 */
export class Queueing extends TaskState {
  public readonly code = TaskStateCode.Queueing;
  public readonly startable = true;
  public readonly pauseable = true;
  public readonly stoppable = true;
  public readonly editable = false;
  public readonly removable = false;

  public readonly previousState: Idle | Pausing;

  constructor(previousState: Idle | Pausing) {
    super();
    this.previousState = previousState;
  }

  public async start(task: Task): Promise<TaskState> {
    return this.previousState.start(task);
  }

  public async pause(): Promise<TaskState> {
    return this.previousState.pause();
  }

  public async stop(task: Task): Promise<TaskState> {
    return this.previousState.stop(task);
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a queueing task");
    return this;
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

  public lastMessage?: TaskMessageRunning;

  constructor(lastMessage?: TaskMessageRunning) {
    super();
    this.lastMessage = lastMessage;
  }

  public async start(): Promise<TaskState> {
    console.warn("Attempting to start a running task");
    return this;
  }

  public async pause(task: Task): Promise<TaskState> {
    try {
      await pauseTask(task.id);
      return new Pausing(this.lastMessage);
    } catch (err) {
      return new Errored(err as TauriError);
    }
  }

  public async stop(task: Task): Promise<TaskState> {
    try {
      await stopTask(task.id);
      return new Stopped();
    } catch (err) {
      return new Errored(err as TauriError);
    }
  }

  public async finish(): Promise<TaskState> {
    return new Finished();
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

  public lastMessage?: TaskMessageRunning;

  constructor(lastMessage?: TaskMessageRunning) {
    super();
    this.lastMessage = lastMessage;
  }

  public async start(task: Task): Promise<TaskState> {
    if (isOverflow()) {
      return new Queueing(this);
    }

    try {
      await resumeTask(task.id);
      return new Running(this.lastMessage);
    } catch (err) {
      return new Errored(err as TauriError);
    }
  }

  public async pause(): Promise<TaskState> {
    console.warn("Attempting to pause a pausing task");
    return this;
  }

  public async stop(task: Task): Promise<TaskState> {
    try {
      await stopTask(task.id);
      return new Stopped();
    } catch (err) {
      return new Errored(err as TauriError);
    }
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a pausing task");
    return this;
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

  public async start(): Promise<TaskState> {
    console.warn("Attempting to start a stopped task");
    return this;
  }

  public async pause(): Promise<TaskState> {
    console.warn("Attempting to pause a stopped task");
    return this;
  }

  public async stop(): Promise<TaskState> {
    console.warn("Attempting to stop a stopped task");
    return this;
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a stopped task");
    return this;
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

  public readonly reason: TauriError;

  constructor(reason: TauriError) {
    super();
    this.reason = reason;
  }

  public async start(): Promise<TaskState> {
    console.warn("Attempting to start a errored task");
    return this;
  }

  public async pause(): Promise<TaskState> {
    console.warn("Attempting to pause a errored task");
    return this;
  }

  public async stop(): Promise<TaskState> {
    console.warn("Attempting to stop a errored task");
    return this;
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a errored task");
    return this;
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

  public async start(): Promise<TaskState> {
    console.warn("Attempting to start a finished task");
    return this;
  }

  public async pause(): Promise<TaskState> {
    console.warn("Attempting to pause a finished task");
    return this;
  }

  public async stop(): Promise<TaskState> {
    console.warn("Attempting to stop a finished task");
    return this;
  }

  public async finish(): Promise<TaskState> {
    console.warn("Attempting to finish a finished task");
    return this;
  }
}
