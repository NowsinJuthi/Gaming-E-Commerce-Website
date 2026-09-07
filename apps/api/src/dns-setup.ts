import dns from 'node:dns';

// Windows dev: system DNS often blocks MongoDB Atlas SRV lookups.
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');
