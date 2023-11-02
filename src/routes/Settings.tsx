import {
  Button,
  Form,
  FormInstance,
  Grid,
  Input,
  InputNumber,
  Select,
} from "@arco-design/web-react";
import { IconFile, IconFolder } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { useEffect, useRef, useState } from "react";
import { unstable_useBlocker } from "react-router-dom";
import { Configuration, ExitAction, LogLevel, Theme } from "../libs/config";
import { useAppStore } from "../store/app";
import {
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  toMessage,
} from "../tauri/error";
import { loadConfiguration, verifyDirectory, verifyFFmpeg, verifyFFprobe } from "../tauri/system";

/**
 * A page managing system settings.
 */
export default function Settings() {
  const { configuration, updateConfiguration, systemParticulars, setSystemParticulars } =
    useAppStore();
  const formInstance = useRef<FormInstance<Configuration>>(null);

  const [isBlocking, setBlocking] = useState(!systemParticulars);
  const blocker = unstable_useBlocker(isBlocking);
  useEffect(() => {
    if (blocker.state === "blocked" && !isBlocking) {
      blocker.reset();
    }
  }, [blocker, isBlocking]);

  /**
   * Selects FFmoeg program
   */
  const selectFFmpeg = async () => {
    const path = await open({
      title: "Select FFmpeg Program",
      multiple: false,
    });

    if (path) {
      formInstance.current?.setFieldValue("ffmpeg", path as string);
      onChange({
        ffmpeg: path as string,
      });
    }
  };

  /**
   * Selects FFprobe program
   */
  const selectFFprobe = async () => {
    const path = await open({
      title: "Select FFprobe Program",
      multiple: false,
    });

    if (path) {
      formInstance.current?.setFieldValue("ffprobe", path as string);
      formInstance.current?.validate(["ffprobe"]).then((value) => {
        updateConfiguration({
          ffprobe: value.ffprobe as string,
        });
      });
    }
  };

  /**
   * Selects save default directory
   */
  const selectDefaultSaveDirectory = async () => {
    const path = await open({
      title: "Select Default Save Directory",
      directory: true,
      multiple: false,
    });

    if (path) {
      formInstance.current?.setFieldValue("saveDirectory", path as string);
      updateConfiguration({
        saveDirectory: path as string,
      });
    }
  };

  /**
   * Stores local configuration after form changes and successfully validates.
   */
  const onChange = (localConfiguration: Partial<Configuration>) => {
    formInstance.current
      ?.validate()
      .then(async (config) => {
        if (localConfiguration.saveDirectory) {
          localConfiguration.saveDirectory = localConfiguration.saveDirectory.trim();
        }

        config.ffmpeg = config.ffmpeg.trim();
        config.ffprobe = config.ffprobe.trim();

        setSystemParticulars(await loadConfiguration(config));
        updateConfiguration(localConfiguration);
        setBlocking(false);
      })
      .catch((err) => {
        console.error(err);
        setBlocking(true);
      });
  };

  return (
    <div className="p-4">
      <Form
        size="mini"
        labelCol={{ style: { flexBasis: "10rem" } }}
        wrapperCol={{ style: { width: "auto", flexBasis: "auto", flex: "1" } }}
        initialValues={configuration}
        ref={formInstance}
        onChange={onChange}
      >
        <Grid.Row gutter={8}>
          {/* Log Level */}
          <Grid.Col span={12}>
            <Form.Item field="loglevel" label="Log Level">
              <Select>
                <Select.Option value={LogLevel.Off}>Off</Select.Option>
                <Select.Option value={LogLevel.Error}>Error</Select.Option>
                <Select.Option value={LogLevel.Warn}>Warn</Select.Option>
                <Select.Option value={LogLevel.Info}>Info</Select.Option>
                <Select.Option value={LogLevel.Debug}>Debug</Select.Option>
                <Select.Option value={LogLevel.Trace}>Trace</Select.Option>
              </Select>
            </Form.Item>
          </Grid.Col>

          {/* Theme Switcher */}
          <Grid.Col span={12}>
            <Form.Item
              labelCol={{ style: { flexBasis: "fit-content", textAlign: "left" } }}
              field="theme"
              label="Theme"
            >
              <Select>
                <Select.Option value={Theme.Dark}>Dark</Select.Option>
                <Select.Option value={Theme.Light}>Light</Select.Option>
                <Select.Option value={Theme.FollowSystem}>Follow System</Select.Option>
              </Select>
            </Form.Item>
          </Grid.Col>
        </Grid.Row>

        {/* Max Running Tasks */}
        <Grid.Row gutter={8}>
          <Grid.Col span={12}>
            <Form.Item field="maxRunning" label="Max Running Tasks">
              <InputNumber min={1}></InputNumber>
            </Form.Item>
          </Grid.Col>

          {/* Exit Action */}
          <Grid.Col span={12}>
            <Form.Item
              labelCol={{ style: { flexBasis: "fit-content", textAlign: "left" } }}
              field="exitAction"
              label="Exit Action"
            >
              <Select>
                <Select.Option value={ExitAction.Exit}>Exit Program</Select.Option>
                <Select.Option value={ExitAction.Hide}>Hide Window</Select.Option>
                <Select.Option value={ExitAction.Ask}>Ask</Select.Option>
              </Select>
            </Form.Item>
          </Grid.Col>
        </Grid.Row>

        {/* Hardware Acceleration Method */}
        <Form.Item
          labelCol={{ style: { flexBasis: "20rem" } }}
          field="hwaccel"
          label="Hardware Acceleration Method for Auto Decoding"
          formatter={(value) => value ?? -1}
          normalize={(selection) => (selection === -1 ? undefined : selection)}
        >
          <Select>
            <Select.Option value={-1}>Disable</Select.Option>
            {systemParticulars?.ffmpeg.hwaccels.map((method) => {
              return (
                <Select.Option key={method} value={method}>
                  {method}
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>

        {/* FFmpeg Program */}
        <Form.Item
          field="ffmpeg"
          label="FFmpeg Program"
          rules={[
            {
              validator(value, callback) {
                return verifyFFmpeg(value)
                  .then(() => {
                    callback();
                  })
                  .catch((err: FFmpegNotFoundError | FFmpegUnavailableError) => {
                    callback(toMessage(err));
                  });
              },
            },
          ]}
        >
          <Input
            placeholder="ffmpeg program"
            beforeStyle={{ padding: "0" }}
            addBefore={<Button type="text" icon={<IconFile />} onClick={selectFFmpeg} />}
          ></Input>
        </Form.Item>

        {/* FFprobe Program */}
        <Form.Item
          field="ffprobe"
          label="FFprobe Program"
          rules={[
            {
              validator(value, callback) {
                return verifyFFprobe(value)
                  .then(() => {
                    callback();
                  })
                  .catch((err: FFprobeNotFoundError | FFprobeUnavailableError) => {
                    callback(toMessage(err));
                  });
              },
            },
          ]}
        >
          <Input
            placeholder="ffprobe program"
            beforeStyle={{ padding: "0" }}
            addBefore={<Button type="text" icon={<IconFile />} onClick={selectFFprobe} />}
          ></Input>
        </Form.Item>

        {/* FFprobe Program */}
        <Form.Item
          field="saveDirectory"
          label="Default Save Directory"
          rules={[
            {
              validator(value, callback) {
                if (!value) callback();

                return verifyDirectory(value)
                  .then(() => {
                    callback();
                  })
                  .catch((err: FFprobeNotFoundError | FFprobeUnavailableError) => {
                    callback(toMessage(err));
                  });
              },
            },
          ]}
        >
          <Input
            allowClear
            beforeStyle={{ padding: "0" }}
            addBefore={
              <Button type="text" icon={<IconFolder />} onClick={selectDefaultSaveDirectory} />
            }
          ></Input>
        </Form.Item>
      </Form>
    </div>
  );
}
