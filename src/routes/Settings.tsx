import { Form, FormInstance, Grid, Input, Select } from "@arco-design/web-react";
import { useEffect, useRef, useState } from "react";
import { unstable_useBlocker } from "react-router-dom";
import { Configuration, LogLevel, Theme, useAppStore } from "../store/app";
import {
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  toShortMessage,
} from "../tauri/error";
import { loadConfiguration, verifyFFmpeg, verifyFFprobe } from "../tauri/system";

/**
 * A page managing system settings.
 */
export default function Settings() {
  const { systemParticulars, setSystemParticulars, configuration, setLocalConfiguration } =
    useAppStore((state) => state);
  const formInstance = useRef<FormInstance<Configuration>>(null);

  const [isBlocking, setBlocking] = useState(!systemParticulars);
  const blocker = unstable_useBlocker(isBlocking);
  useEffect(() => {
    if (blocker.state === "blocked" && !isBlocking) {
      blocker.reset();
    }
  }, [blocker, isBlocking]);

  const onChange = (localConfiguration: Partial<Configuration>) => {
    if (localConfiguration.saveDirectory) {
      const trimmed = localConfiguration.saveDirectory.trim();
      if (!trimmed) {
        formInstance.current?.clearFields("saveDirectory");
      }
    }

    formInstance.current
      ?.validate()
      .then(async (config) => {
        setSystemParticulars(await loadConfiguration(config));
        setLocalConfiguration(localConfiguration);
        setBlocking(false);
      })
      .catch((err) => {
        console.error(err);
        setBlocking(true);
      });
  };

  return (
    <Form
      size="mini"
      labelCol={{ style: { flexBasis: "10rem" } }}
      wrapperCol={{ style: { width: "auto", flexBasis: "auto", flex: "1" } }}
      initialValues={configuration}
      ref={formInstance}
      onChange={onChange}
    >
      <Grid.Row gutter={8}>
        <Grid.Col span={12}>
          {/* Log Level */}
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
          <Form.Item labelCol={{ style: { flexBasis: "4rem" } }} field="theme" label="Theme">
            <Select>
              <Select.Option value={Theme.Dark}>Dark</Select.Option>
              <Select.Option value={Theme.Light}>Light</Select.Option>
              <Select.Option value={Theme.FollowSystem}>Follow System</Select.Option>
            </Select>
          </Form.Item>
        </Grid.Col>
      </Grid.Row>

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
                  callback(toShortMessage(err));
                });
            },
          },
        ]}
      >
        <Input placeholder="ffmpeg program"></Input>
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
                  console.log(err);

                  callback(toShortMessage(err));
                });
            },
          },
        ]}
      >
        <Input placeholder="ffprobe program"></Input>
      </Form.Item>

      {/* FFprobe Program */}
      <Form.Item field="saveDirectory" label="Default Save Directory">
        <Input allowClear></Input>
      </Form.Item>
    </Form>
  );
}
