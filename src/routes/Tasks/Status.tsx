import { Spin } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconCloseCircle,
  IconMore,
  IconPauseCircle,
  IconPlayCircle,
  IconRecordStop,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task } from "../../libs/task";
import { TaskStateCode } from "../../libs/task/state_machine";

const iconSize = "20px";

export default function Progress({ task }: { task: Task }) {
  if (task.isCommanding) {
    return <Spin size={20}></Spin>;
  }

  switch (task.state.code) {
    case TaskStateCode.Idle:
      return <IconRecordStop fontSize={iconSize} />;
    case TaskStateCode.Running:
      return <IconPlayCircle fontSize={iconSize} style={{ color: "rgb(var(--primary-5))" }} />;
    case TaskStateCode.Queueing:
      return <IconMore fontSize={iconSize} style={{ color: "rgb(var(--warning-6))" }} />;
    case TaskStateCode.Pausing:
      return <IconPauseCircle fontSize={iconSize} style={{ color: "rgb(var(--warning-6))" }} />;
    case TaskStateCode.Stopped:
      return <IconStop fontSize={iconSize} style={{ color: "rgb(var(--danger-6))" }} />;
    case TaskStateCode.Finished:
      return <IconCheckCircle fontSize={iconSize} style={{ color: "rgb(var(--success-6))" }} />;
    case TaskStateCode.Errored:
      return <IconCloseCircle fontSize={iconSize} style={{ color: "rgb(var(--danger-6))" }} />;
  }
}
