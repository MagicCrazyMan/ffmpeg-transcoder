import { Button, Divider, Space, Tooltip, Typography } from "@arco-design/web-react";
import {
  IconDelete,
  IconPause,
  IconPlayArrow,
  IconPlus,
  IconStop,
  IconSubscribeAdd,
} from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { TaskStateCode } from "../../libs/task/state_machine";
import { useTaskStore } from "../../store/task";

export default function GlobalOperations({
  setSimpleTasksAddingVisible,
  setComplexTaskModifierVisible,
}: {
  setSimpleTasksAddingVisible: (visible: boolean) => void;
  setComplexTaskModifierVisible: (visible: boolean) => void;
}) {
  const { tasks, startAllTasks, pauseAllTasks, stopAllTasks, removeAllTasks } = useTaskStore();
  const {
    total,
    idlesCount,
    commandingCount,
    erroredCount,
    finishedCount,
    pausingCount,
    queueingCount,
    runningCount,
    stoppedCount,
  } = useMemo(() => {
    let idlesCount = 0;
    let commandingCount = 0;
    let queueingCount = 0;
    let runningCount = 0;
    let pausingCount = 0;
    let stoppedCount = 0;
    let finishedCount = 0;
    let erroredCount = 0;

    tasks.forEach((task) => {
      if (task.isCommanding) {
        commandingCount++;
        return;
      }

      switch (task.state.code) {
        case TaskStateCode.Idle:
          idlesCount++;
          break;
        case TaskStateCode.Running:
          runningCount++;
          break;
        case TaskStateCode.Queueing:
          queueingCount++;
          break;
        case TaskStateCode.Pausing:
          pausingCount++;
          break;
        case TaskStateCode.Stopped:
          stoppedCount++;
          break;
        case TaskStateCode.Finished:
          finishedCount++;
          break;
        case TaskStateCode.Errored:
          erroredCount++;
          break;
      }
    });

    return {
      total: tasks.length,
      idlesCount,
      commandingCount,
      queueingCount,
      runningCount,
      pausingCount,
      stoppedCount,
      finishedCount,
      erroredCount,
    };
  }, [tasks]);

  return (
    <div className="flex justify-between items-center flex-wrap">
      <Space>
        {/* Add Multiple Simple Tasks Button */}
        <Tooltip content="Add Multiple Simple Tasks">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlus />}
            onClick={() => setSimpleTasksAddingVisible(true)}
          ></Button>
        </Tooltip>

        {/* Add or Modify Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            type="primary"
            icon={<IconSubscribeAdd />}
            onClick={() => setComplexTaskModifierVisible(true)}
          ></Button>
        </Tooltip>

        <Divider type="vertical"></Divider>

        {/* Start All Tasks Button */}
        <Tooltip content="Start All Tasks">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlayArrow />}
            onClick={startAllTasks}
          ></Button>
        </Tooltip>

        {/* Pause All Tasks Button */}
        <Tooltip content="Pause All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="warning"
            icon={<IconPause />}
            onClick={pauseAllTasks}
          ></Button>
        </Tooltip>

        {/* Stop All Tasks Button */}
        <Tooltip content="Stop All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconStop />}
            onClick={stopAllTasks}
          ></Button>
        </Tooltip>

        {/* Remove All Tasks Button */}
        <Tooltip content="Remove All Tasks">
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={removeAllTasks}
          ></Button>
        </Tooltip>
      </Space>

      <Space>
        <Typography.Text type="secondary">{total} Tasks</Typography.Text>|
        <Typography.Text type="secondary">{idlesCount} Idles</Typography.Text>|
        <Typography.Text type="primary">{commandingCount} Commanding</Typography.Text>|
        <Typography.Text type="primary">{runningCount} Running</Typography.Text>|
        <Typography.Text type="warning">{queueingCount} Queueing</Typography.Text>|
        <Typography.Text type="warning">{pausingCount} Pausing</Typography.Text>|
        <Typography.Text type="error">{stoppedCount} Stopped</Typography.Text>|
        <Typography.Text type="error">{erroredCount} Errored</Typography.Text>|
        <Typography.Text type="success">{finishedCount} Finished</Typography.Text>
      </Space>
    </div>
  );
}
