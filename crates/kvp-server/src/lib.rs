#![forbid(unsafe_code)]

//! Generated KVP gRPC bindings and a production-oriented mTLS server entry point.
//!
//! Certificate-to-principal mapping, TLS 1.3 policy enforcement, request limits,
//! and rate limiting are deliberately not hidden in this crate. They are M1 work
//! that must be added before a process accepts production traffic.

use std::net::SocketAddr;

use tonic::transport::{Certificate, Identity, Server, ServerTlsConfig};

// Tonic generates the service trait with `tonic::Status` as its public error
// type. This lint cannot be resolved without changing the generated contract.
#[allow(clippy::result_large_err)]
pub mod proto {
    tonic::include_proto!("netcity.kvp.v1");
}

/// PEM material needed for a server that requires a client certificate.
///
/// The material must come from a protected runtime secret provider, never from
/// protobuf requests or source control.
#[derive(Clone, Debug)]
pub struct MtlsMaterial {
    pub trust_anchor_pem: Vec<u8>,
    pub certificate_pem: Vec<u8>,
    pub private_key_pem: Vec<u8>,
}

/// Builds the tonic transport configuration that presents the server identity
/// and requires a client certificate chaining to the configured trust anchor.
pub fn mtls_config(material: &MtlsMaterial) -> ServerTlsConfig {
    ServerTlsConfig::new()
        .identity(Identity::from_pem(
            material.certificate_pem.clone(),
            material.private_key_pem.clone(),
        ))
        .client_ca_root(Certificate::from_pem(material.trust_anchor_pem.clone()))
}

/// Starts the generated KVP control-plane service with mutual TLS enabled.
///
/// Callers must supply a service that performs certificate-to-principal binding
/// and policy checks. This function is not a plaintext fallback.
pub async fn serve<S>(
    address: SocketAddr,
    material: MtlsMaterial,
    service: S,
) -> Result<(), tonic::transport::Error>
where
    S: proto::control_plane_service_server::ControlPlaneService + Send + Sync + 'static,
{
    Server::builder()
        .tls_config(mtls_config(&material))?
        .add_service(proto::control_plane_service_server::ControlPlaneServiceServer::new(service))
        .serve(address)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mtls_configuration_accepts_pem_material() {
        let material = MtlsMaterial {
            trust_anchor_pem: b"test-ca".to_vec(),
            certificate_pem: b"test-certificate".to_vec(),
            private_key_pem: b"test-private-key".to_vec(),
        };

        let _ = mtls_config(&material);
    }

    #[test]
    fn generated_contract_exposes_the_v1_service() {
        let _ = proto::control_plane_service_server::ControlPlaneServiceServer::<
            UnimplementedService,
        >::new(UnimplementedService);
    }

    struct UnimplementedService;

    #[tonic::async_trait]
    impl proto::control_plane_service_server::ControlPlaneService for UnimplementedService {
        async fn open_session(
            &self,
            _request: tonic::Request<proto::OpenSessionRequest>,
        ) -> Result<tonic::Response<proto::OpenSessionResponse>, tonic::Status> {
            Err(tonic::Status::unimplemented("test service"))
        }

        async fn execute_command(
            &self,
            _request: tonic::Request<proto::ExecuteCommandRequest>,
        ) -> Result<tonic::Response<proto::ExecuteCommandResponse>, tonic::Status> {
            Err(tonic::Status::unimplemented("test service"))
        }

        async fn get_command(
            &self,
            _request: tonic::Request<proto::GetCommandRequest>,
        ) -> Result<tonic::Response<proto::GetCommandResponse>, tonic::Status> {
            Err(tonic::Status::unimplemented("test service"))
        }

        async fn get_status(
            &self,
            _request: tonic::Request<proto::GetStatusRequest>,
        ) -> Result<tonic::Response<proto::GetStatusResponse>, tonic::Status> {
            Err(tonic::Status::unimplemented("test service"))
        }
    }
}
