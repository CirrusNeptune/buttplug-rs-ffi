
import { ButtplugEmbeddedConnectorOptions, ButtplugWebsocketConnectorOptions } from "./connectors";
import { ButtplugMessageSorter } from "./sorter";
import { Buttplug } from "./buttplug_ffi";

function must_run_init_1(a: any | undefined): any {
  throw new Error("Must run buttplugInit() async before calling any Buttplug methods!");
}

function must_run_init_2(a: any | undefined, b: any | undefined): any {
  throw new Error("Must run buttplugInit() async before calling any Buttplug methods!");
}
// import { buttplug_create_client, buttplug_free_client, buttplug_parse_client_message, buttplug_activate_env_logger, buttplug_free_device, buttplug_create_device, buttplug_parse_device_message } from "./buttplug-rs-ffi/buttplug_rs_ffi";

let buttplug_create_client = must_run_init_2;
let buttplug_free_client = must_run_init_1;
let buttplug_parse_client_message = must_run_init_2;
let buttplug_activate_env_logger = must_run_init_1;
let buttplug_free_device = must_run_init_1;
let buttplug_create_device = must_run_init_2;
let buttplug_parse_device_message = must_run_init_2;
let buttplug_has_init_run = false;

export async function buttplugInit() {
  if (buttplug_has_init_run) {
    console.log("buttplugInit function has already run successfully. This only needs to be run once, but doesn't affect anything (other than printing this message) if called again.");
    return;
  }
  let index = await import(/* webpackPrefetch: 1 */ "./buttplug-rs-ffi/buttplug_rs_ffi").catch((e) => {
    console.log(e);
    return Promise.reject(e);
  });
  console.log(index);
  buttplug_create_client = index.buttplug_create_client;
  buttplug_free_client = index.buttplug_free_client;
  buttplug_parse_client_message = index.buttplug_parse_client_message;
  buttplug_activate_env_logger = index.buttplug_activate_env_logger;
  buttplug_free_device = index.buttplug_free_device;
  buttplug_create_device = index.buttplug_create_device;
  buttplug_parse_device_message = index.buttplug_parse_device_message;
  buttplug_has_init_run = true;
}

function sendClientMessage(sorter: ButtplugMessageSorter, clientPtr: number, message: Buttplug.ClientMessage): Promise<Buttplug.ButtplugFFIServerMessage> {
  let promise = sorter.PrepareOutgoingMessage(message);
  let buffer = Buffer.from(Buttplug.ClientMessage.encode(message).finish())
  buttplug_parse_client_message(clientPtr, buffer);
  return promise;
}

export function connectEmbedded(sorter: ButtplugMessageSorter, clientPtr: number, options: ButtplugEmbeddedConnectorOptions): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      connectLocal: Buttplug.ClientMessage.ConnectLocal.create({
        serverName: options.ServerName,
        allowRawMessages: options.AllowRawMessages,
        deviceConfigurationJson: options.DeviceConfigJSON,
        userDeviceConfigurationJson: options.UserDeviceConfigJSON,
        commManagerTypes: options.DeviceCommunicationManagerTypes,
        maxPingTime: options.MaxPingTime
      })
    }),
    id: 1
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

export function connectWebsocket(sorter: ButtplugMessageSorter, clientPtr: number, options: ButtplugWebsocketConnectorOptions): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      connectWebsocket: Buttplug.ClientMessage.ConnectWebsocket.create({
        address: options.Address
      })
    }),
    id: 1
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

export function disconnect(sorter: ButtplugMessageSorter, clientPtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      disconnect: Buttplug.ClientMessage.Disconnect.create({})
    })
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

export function startScanning(sorter: ButtplugMessageSorter, clientPtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      startScanning: Buttplug.ClientMessage.StartScanning.create({})
    }),
    id: 1
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

export function stopScanning(sorter: ButtplugMessageSorter, clientPtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      stopScanning: Buttplug.ClientMessage.StopScanning.create({})
    }),
    id: 1
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

export function stopAllDevices(sorter: ButtplugMessageSorter, clientPtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.ClientMessage.create({
    message: Buttplug.ClientMessage.FFIMessage.create({
      stopAllDevices: Buttplug.ClientMessage.StopAllDevices.create({})
    }),
    id: 1
  });
  return sendClientMessage(sorter, clientPtr, msg);
}

function sendDeviceMessage(sorter: ButtplugMessageSorter, devicePtr: number, message: Buttplug.DeviceMessage): Promise<Buttplug.ButtplugFFIServerMessage> {
  let promise = sorter.PrepareOutgoingMessage(message);
  let buffer = Buffer.from(Buttplug.DeviceMessage.encode(message).finish())
  buttplug_parse_device_message(devicePtr, buffer);
  return promise;
}

export function vibrate(sorter: ButtplugMessageSorter, devicePtr: number, speeds: Buttplug.DeviceMessage.VibrateComponent[]): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      vibrateCmd: Buttplug.DeviceMessage.VibrateCmd.create({
        speeds: speeds
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rotate(sorter: ButtplugMessageSorter, devicePtr: number, rotations: Buttplug.DeviceMessage.RotateComponent[]): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rotateCmd: Buttplug.DeviceMessage.RotateCmd.create({
        rotations: rotations
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function linear(sorter: ButtplugMessageSorter, devicePtr: number, vectors: Buttplug.DeviceMessage.LinearComponent[]): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      linearCmd: Buttplug.DeviceMessage.LinearCmd.create({
        movements: vectors
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function stopDevice(sorter: ButtplugMessageSorter, devicePtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      stopDeviceCmd: Buttplug.DeviceMessage.StopDeviceCmd.create({
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function batteryLevel(sorter: ButtplugMessageSorter, devicePtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      batteryLevelCmd: Buttplug.DeviceMessage.BatteryLevelCmd.create({
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rssiLevel(sorter: ButtplugMessageSorter, devicePtr: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rssiLevelCmd: Buttplug.DeviceMessage.RSSILevelCmd.create({
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rawRead(sorter: ButtplugMessageSorter, devicePtr: number, endpoint: Buttplug.Endpoint, expectedLength: number, timeout: number): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rawReadCmd: Buttplug.DeviceMessage.RawReadCmd.create({
        endpoint: endpoint,
        expectedLength: expectedLength,
        timeout: timeout
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rawWrite(sorter: ButtplugMessageSorter, devicePtr: number, endpoint: Buttplug.Endpoint, data: Uint8Array, writeWithResponse: boolean): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rawWriteCmd: Buttplug.DeviceMessage.RawWriteCmd.create({
        endpoint: endpoint,
        data: data,
        writeWithResponse: writeWithResponse
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rawSubscribe(sorter: ButtplugMessageSorter, devicePtr: number, endpoint: Buttplug.Endpoint): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rawSubscribeCmd: Buttplug.DeviceMessage.RawSubscribeCmd.create({
        endpoint: endpoint
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function rawUnsubscribe(sorter: ButtplugMessageSorter, devicePtr: number, endpoint: Buttplug.Endpoint): Promise<Buttplug.ButtplugFFIServerMessage> {
  let msg = Buttplug.DeviceMessage.create({
    message: Buttplug.DeviceMessage.FFIMessage.create({
      rawUnsubscribeCmd: Buttplug.DeviceMessage.RawUnsubscribeCmd.create({
        endpoint: endpoint
      })
    }),
    id: 1
  });
  return sendDeviceMessage(sorter, devicePtr, msg);
}

export function createClientPtr(eventCallback: Function, clientName: string): number {
  return buttplug_create_client(eventCallback, clientName);
}

export function createDevicePtr(clientPtr: number, deviceIndex: number): number | null {
  return buttplug_create_device(clientPtr, deviceIndex);
}

export function freeClientPtr(clientPtr: number) {
  buttplug_free_client(clientPtr);
}

export function freeDevicePtr(devicePtr: number) {
  buttplug_free_device(devicePtr);
}

export function activateConsoleLogger(logLevel: "error" | "warn" | "info" | "debug" | "trace") {
  buttplug_activate_env_logger(logLevel);
}

/*
export function addLogHandler(logCallback: Function, logLevel: "error" | "warn" | "info" | "debug" | "trace", useJSON: boolean) {
  buttplug_add_log_handler(logCallback, logLevel, useJSON);
}
*/