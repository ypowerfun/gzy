#!/bin/bash
# Rede de teste com sub-redes (Linux, root, iproute2 + iptables): servidor 192.168.0.10 <-> roteador <-> PC 192.168.1.20.
# Precisa do CertTool de teste: cp testes/linux/CertTool-linux.sh servidor/server/CertTool.exe (apagar depois).
set -e; cd "$(dirname "$0")"
for n in gzsrv gzrtr gzpc; do ip netns del $n 2>/dev/null || true; ip netns add $n; done
ip link add s0 type veth peer name r0; ip link add p0 type veth peer name r1
ip link set s0 netns gzsrv; ip link set r0 netns gzrtr; ip link set r1 netns gzrtr; ip link set p0 netns gzpc
ip -n gzsrv addr add 192.168.0.10/24 dev s0; ip -n gzsrv link set s0 up; ip -n gzsrv link set lo up; ip -n gzsrv route add default via 192.168.0.1
ip -n gzrtr addr add 192.168.0.1/24 dev r0; ip -n gzrtr addr add 192.168.1.1/24 dev r1; ip -n gzrtr link set r0 up; ip -n gzrtr link set r1 up; ip netns exec gzrtr sysctl -qw net.ipv4.ip_forward=1
ip -n gzpc addr add 192.168.1.20/24 dev p0; ip -n gzpc link set p0 up; ip -n gzpc link set lo up; ip -n gzpc route add default via 192.168.1.1
(ip netns exec gzsrv node srv.js 30000 > /tmp/gz-srv.log 2>&1 &); sleep 3
ip netns exec gzpc node pc.js
sleep 1; for n in gzsrv gzrtr gzpc; do ip netns del $n; done
