import { Button, Checkbox, Modal, Typography } from "@arco-design/web-react";
import { listen } from "@tauri-apps/api/event";
import { exit } from "@tauri-apps/api/process";
import { appWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../store/app";
import { useTaskStore } from "../store/task";
import { ExitAction } from "./config";

export const EXIT_REQUEST_EVENT = "exit_request";

const onExit = async () => {
  // double confirm if tasks is not empty
  if (useTaskStore.getState().tasks.length !== 0) {
    const modal = Modal.confirm({
      title: "Are you sure to exit?",
      content: "All tasks will be stopped and dropped if you select to exit.",
      closable: true,
      cancelButtonProps: {
        size: "small",
      },
      okButtonProps: {
        size: "small",
        status: "danger",
      },
      onOk: async () => {
        modal.update({
          okText: "Stopping Tasks...",
          cancelButtonProps: {
            disabled: true,
          },
          closable: false,
          escToExit: false,
          maskClosable: false,
        });
        await useTaskStore.getState().stopAllTasks();
        await exit(0);
      },
    });
  } else {
    // exit directly otherwise
    await exit(0);
  }
};

const onAsk = async () => {
  let remember = false;
  const content = (
    <>
      <Typography.Paragraph>
        All tasks will be stopped and dropped if you select to exit.
      </Typography.Paragraph>

      <Checkbox onChange={(checked) => (remember = checked)}>
        Do not ask again
        <Typography.Text type="secondary"> (modifiable in Settings page)</Typography.Text>
      </Checkbox>
    </>
  );

  const modal = Modal.confirm({
    content,
    closable: true,
    title: "Close Action",
    footer: (
      <>
        {/* Cancel Button */}
        <Button size="small" type="secondary" onClick={() => modal.close()}>
          Cancel
        </Button>

        {/* Close & Hide Button */}
        <Button
          size="small"
          type="primary"
          onClick={async () => {
            if (remember) {
              useAppStore.getState().updateConfiguration({
                exitAction: ExitAction.Hide,
              });
            }

            await appWindow.hide();
            modal.close();
          }}
        >
          Hide
        </Button>

        {/* Close & Exit Button */}
        <Button
          size="small"
          status="danger"
          onClick={async () => {
            if (remember) {
              useAppStore.getState().updateConfiguration({
                exitAction: ExitAction.Exit,
              });
            }

            modal.update({
              okText: "Stopping Tasks...",
              cancelButtonProps: {
                disabled: true,
              },
              closable: false,
              escToExit: false,
              maskClosable: false,
            });
            await useTaskStore.getState().stopAllTasks();
            await exit(0);
          }}
        >
          Exit
        </Button>
      </>
    ),
  });
};

/**
 * Starts listening exit request event from backend
 */
listen<void>(EXIT_REQUEST_EVENT, async () => {
  const action = useAppStore.getState().configuration.exitAction;
  switch (action) {
    case ExitAction.Ask: {
      await onAsk();
      break;
    }
    case ExitAction.Exit: {
      await onExit();
      break;
    }
    case ExitAction.Hide:
      await appWindow.hide();
      break;
  }
});
