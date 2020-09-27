use super::{
  FFICallback,
  device::ButtplugFFIDevice,
  util::{return_client_result, return_ok, return_error, send_event},
  pbufs::{
    ButtplugFfiClientMessage as FFIClientMessage, buttplug_ffi_client_message::ffi_message::Msg as FFIClientMessageType,
    client_message::{ConnectLocal, ConnectWebsocket, Msg as ClientMessageType, DeviceCommunicationManagerTypes}
  }
};
use std::{slice, sync::Arc};
use async_std::sync::RwLock;
use buttplug::{
  core::messages::{ButtplugCurrentSpecClientMessage, ButtplugCurrentSpecServerMessage, serializer::ButtplugClientJSONSerializer},
  client::{ButtplugClient, ButtplugClientEvent, device::ButtplugClientDevice},
  connector::{ButtplugInProcessClientConnector, ButtplugConnector, ButtplugConnectorError, ButtplugWebsocketClientTransport, ButtplugRemoteClientConnector},
  server::{
    comm_managers::{
      btleplug::BtlePlugCommunicationManager,
      lovense_dongle::{
        LovenseHIDDongleCommunicationManager, LovenseSerialDongleCommunicationManager,
      },
      serialport::SerialPortCommunicationManager,
    },
  },
  util::async_manager
};
use dashmap::DashMap;
#[cfg(target_os = "windows")]
use buttplug::server::comm_managers::xinput::XInputDeviceCommunicationManager;
use futures::StreamExt;
use prost::Message;

pub struct ButtplugFFIClient {
  name: String,
  callback: Option<FFICallback>,
  client: Arc<RwLock<Option<ButtplugClient>>>,
  devices: Arc<DashMap<u32, ButtplugClientDevice>>
}

impl Drop for ButtplugFFIClient {
  fn drop(&mut self) {
    info!("DROPPED RUST FFI CLIENT");
  }
}

impl ButtplugFFIClient {
  pub fn new(name: &str, callback: Option<FFICallback>) -> Self {
    Self {
      name: name.to_owned(),
      callback,
      client: Arc::new(RwLock::new(None)),
      devices: Arc::new(DashMap::new())
    }
  }

  pub fn get_device(&self, device_index: u32) -> Option<ButtplugFFIDevice> {
    if self.devices.contains_key(&device_index) {
      let device = self.devices.get(&device_index).unwrap();
      Some(ButtplugFFIDevice::new(device.value().clone(), self.callback))
    } else {
      error!("Device id {} not available.", device_index);
      None
    }
  }

  pub fn parse_message(&self, buf: *const u8, buf_len: i32) {
    let msg_ptr: &[u8];
    unsafe {
      msg_ptr = slice::from_raw_parts(buf, buf_len as usize);
    }
    let ffi_msg = FFIClientMessage::decode(msg_ptr).unwrap();
    let msg_id = ffi_msg.id;
    if let FFIClientMessageType::ClientMessage(client_msg) = ffi_msg.message.unwrap().msg.unwrap() {
      match client_msg.msg.unwrap() {
        ClientMessageType::ConnectLocal(connect_local_msg) => self.connect_local(msg_id, &connect_local_msg),
        ClientMessageType::ConnectWebsocket(connect_websocket_msg) => self.connect_websocket(msg_id, &connect_websocket_msg),
        ClientMessageType::StartScanning(_) => self.start_scanning(msg_id),
        ClientMessageType::StopScanning(_) => self.stop_scanning(msg_id),
      }
    } else {
      panic!("Sent device message to client parser!");
    }
  }

  fn connect<T>(&self, client_msg_id: u32, connector: T) 
  where T: ButtplugConnector<ButtplugCurrentSpecClientMessage, ButtplugCurrentSpecServerMessage>  + 'static {
    info!("Making client with name {}, id {}", self.name, client_msg_id);
    let client = self.client.clone();
    let client_name = self.name.clone();
    let callback = self.callback.clone();
    let device_map = self.devices.clone();

    async_manager::spawn(async move {
      match ButtplugClient::connect(&client_name, connector).await {
        Ok((bp_client, mut event_stream)) => {
          *(client.write().await) = Some(bp_client);
          let event_callback = callback.clone();
          async_manager::spawn(async move {
            while let Some(e) = event_stream.next().await {
              match &e {
                ButtplugClientEvent::DeviceAdded(device) => {
                  device_map.insert(device.index(), device.clone());
                },
                ButtplugClientEvent::DeviceRemoved(device) => {
                  device_map.remove(&device.device_index);
                }
                _ => {}
              };
              send_event(e, event_callback);
            }
          }).unwrap();
          return_ok(client_msg_id, callback);    
        },
        Err(e) => {
          return_error(client_msg_id, e, callback);
        }
      }
    }).unwrap();
  }

  fn connect_local(&self, msg_id: u32, connect_local_msg: &ConnectLocal) {
    let connector = ButtplugInProcessClientConnector::new(&connect_local_msg.server_name, connect_local_msg.max_ping_time as u64);
    let device_mgrs = connect_local_msg.comm_manager_types;
    if device_mgrs & DeviceCommunicationManagerTypes::LovenseHidDongle as u32 > 0 || device_mgrs == 0 {
      connector.server_ref().add_comm_manager::<LovenseHIDDongleCommunicationManager>().unwrap(); 
    }
    if device_mgrs & DeviceCommunicationManagerTypes::LovenseSerialDongle as u32 > 0 || device_mgrs == 0 {
      connector.server_ref().add_comm_manager::<LovenseSerialDongleCommunicationManager>().unwrap(); 
    }
    if device_mgrs & DeviceCommunicationManagerTypes::Btleplug as u32 > 0 || device_mgrs == 0 {
      connector.server_ref().add_comm_manager::<BtlePlugCommunicationManager>().unwrap(); 
    }
    #[cfg(target_os="windows")]
    if device_mgrs & DeviceCommunicationManagerTypes::XInput as u32 > 0 || device_mgrs == 0 {
      connector.server_ref().add_comm_manager::<XInputDeviceCommunicationManager>().unwrap(); 
    }
    if device_mgrs & DeviceCommunicationManagerTypes::SerialPort as u32 > 0 || device_mgrs == 0 {
      connector.server_ref().add_comm_manager::<SerialPortCommunicationManager>().unwrap(); 
    }
    self.connect(msg_id, connector);
  }

  fn connect_websocket(&self, msg_id: u32, connect_websocket_msg: &ConnectWebsocket) {
    let connector: ButtplugRemoteClientConnector<_, ButtplugClientJSONSerializer> = if connect_websocket_msg.address.contains("wss://") {
      let transport = ButtplugWebsocketClientTransport::new_secure_connector(&connect_websocket_msg.address, connect_websocket_msg.bypass_cert_verification);
      ButtplugRemoteClientConnector::new(transport)
    } else {
      let transport = ButtplugWebsocketClientTransport::new_insecure_connector(&connect_websocket_msg.address);
      ButtplugRemoteClientConnector::new(transport)
    };
    self.connect(msg_id, connector);
  }

  fn start_scanning(&self, msg_id: u32) {
    let client = self.client.clone();
    let callback = self.callback.clone();
    async_manager::spawn(async move {
      if let Some(usable_client) = &(*client.read().await) {
        return_client_result(usable_client.start_scanning().await, msg_id, callback);
      } else {
        return_error(msg_id, ButtplugConnectorError::ConnectorNotConnected.into(), callback)
      }
    }).unwrap();
  }

  fn stop_scanning(&self, msg_id: u32) {
    let client = self.client.clone();
    let callback = self.callback.clone();
    async_manager::spawn(async move {
      if let Some(usable_client) = &(*client.read().await) {
        return_client_result(usable_client.stop_scanning().await, msg_id, callback);
      } else {
        return_error(msg_id, ButtplugConnectorError::ConnectorNotConnected.into(), callback)
      }
    }).unwrap();
  }
}
