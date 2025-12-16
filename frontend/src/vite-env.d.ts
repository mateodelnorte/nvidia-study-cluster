/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GPU_ENDPOINTS: string;
	readonly VITE_SLURM_ENDPOINT: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
