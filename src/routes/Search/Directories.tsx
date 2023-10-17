import { Button, Form, FormInstance, Grid, Input, InputNumber } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { useMemo, useRef } from "react";
import { useAppStore } from "../../store/app";
import { useSearchStore } from "../../store/search";
import { DirectoryNotFoundError, toMessage } from "../../tauri/error";
import { getFilesFromDirectory } from "../../tauri/fs";
import { verifyDirectory } from "../../tauri/system";

/**
 * Input and Output directories input
 */
export default function Directories() {
  const {
    maxDepth,
    setMaxDepth,
    setFiles,
    isFileLoading,
    setFileLoading,
    inputDir,
    outputDir,
    setInputDirectory,
    setOutputDirectory,
  } = useSearchStore();
  const saveDirectory = useAppStore((state) => state.configuration.saveDirectory);

  const formRef =
    useRef<FormInstance<{ inputDir: string; depth: number; outputDir: string }>>(null);
  const initialValues = useMemo(
    () =>
      ({
        inputDir: inputDir ?? "",
        depth: maxDepth,
        outputDir: outputDir ?? saveDirectory ?? "",
      }) as { inputDir: string; outputDir: string },
    [inputDir, maxDepth, outputDir, saveDirectory]
  );

  const selectDirectory = async (type: "input" | "output") => {
    const dir = await open({
      title: type === "input" ? "Select Input Directory" : "Select Output Directory",
      directory: true,
    });

    if (dir) {
      type === "input"
        ? formRef.current?.setFieldValue("inputDir", dir as string)
        : formRef.current?.setFieldValue("outputDir", dir as string);
      onChange();
    }
  };

  const onChange = () => {
    formRef.current?.validate().then((values) => {
      setInputDirectory(values.inputDir);
      setOutputDirectory(values.outputDir);
      setMaxDepth(values.depth);

      if (values.inputDir) {
        setFileLoading(true);
        setFiles([]);
        getFilesFromDirectory(values.inputDir, values.depth)
          .then((files) => {
            setFiles(files);
          })
          .finally(() => {
            setFileLoading(false);
          });
      }
    });
  };

  return (
    <Form
      size="mini"
      wrapperCol={{ span: 24 }}
      ref={formRef}
      initialValues={initialValues}
      onChange={onChange}
    >
      <Grid.Row gutter={8}>
        <Grid.Col span={18}>
          {/* Input Directory */}
          <Form.Item
            field="inputDir"
            rules={[
              {
                validator(value: string | undefined, callback) {
                  if (!value) {
                    return Promise.resolve(callback());
                  } else {
                    return verifyDirectory(value)
                      .then(() => {
                        callback();
                      })
                      .catch((err: DirectoryNotFoundError) => {
                        callback(toMessage(err));
                      });
                  }
                },
              },
            ]}
          >
            <Input
              allowClear
              placeholder="Input Directory"
              beforeStyle={{ padding: "0" }}
              disabled={isFileLoading}
              value={inputDir}
              onChange={setInputDirectory}
              addBefore={
                <Button
                  type="text"
                  icon={<IconFolder />}
                  disabled={isFileLoading}
                  onClick={() => selectDirectory("input")}
                ></Button>
              }
            ></Input>
          </Form.Item>
        </Grid.Col>

        <Grid.Col span={6}>
          {/* Depth Input */}
          <Form.Item
            field="depth"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            label="Max Depth"
          >
            <InputNumber
              size="mini"
              min={0}
              step={1}
              disabled={isFileLoading}
              value={maxDepth}
              onChange={setMaxDepth}
            />
          </Form.Item>
        </Grid.Col>
      </Grid.Row>

      {/* Output Directory */}
      <Form.Item
        field="outputDir"
        extra={
          inputDir && outputDir && inputDir === outputDir
            ? "input & output directory point to same directory"
            : ""
        }
      >
        <Input
          allowClear
          placeholder="Output Directory"
          beforeStyle={{ padding: "0" }}
          value={outputDir}
          onChange={setOutputDirectory}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("output")}
            ></Button>
          }
        ></Input>
      </Form.Item>
    </Form>
  );
}
