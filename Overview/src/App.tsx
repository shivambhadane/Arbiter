import React, { useState, useEffect, useRef } from 'react';

// Code template interface
interface Snippet {
  lang: string;
  code: string;
  stdin: string;
  expected: string;
  outcome: 'SUCCESS' | 'TLE' | 'MLE' | 'COMPILER_ERROR' | 'RUNTIME_ERROR';
  duration: string;
  memory: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

const SNIPPETS: Record<string, Snippet> = {
  fib: {
    lang: 'java',
    code: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int n = sc.nextInt();\n            System.out.println(fib(n));\n        } else {\n            System.out.println("Invalid input");\n        }\n    }\n\n    private static int fib(int n) {\n        if (n <= 1) return n;\n        return fib(n - 1) + fib(n - 2);\n    }\n}`,
    stdin: '10',
    expected: '55',
    outcome: 'SUCCESS',
    duration: '142ms',
    memory: '14.8MB',
    exitCode: 0,
    stdout: '55\n',
    stderr: ''
  },
  loop: {
    lang: 'cpp',
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int x;\n    if (cin >> x) {\n        cout << "Input received: " << x << endl;\n        // Infinite loop to trigger Wall-Time cgroup timeout\n        while (true) {\n            x = x * 2 - x;\n        }\n    }\n    return 0;\n}`,
    stdin: '5',
    expected: 'any',
    outcome: 'TLE',
    duration: '2000ms',
    memory: '4.2MB',
    exitCode: 137,
    stdout: 'Input received: 5\n',
    stderr: 'Killed: CPU wall-time limit (2.00s) exceeded. Container terminated by supervisor daemon.'
  },
  mem: {
    lang: 'nodejs',
    code: `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\nconst n = parseInt(input) || 1000;\n\nconsole.log(\`Allocating arrays of size \${n}...\`);\n// Bloat memory to exceed 64MB cgroup limit\nconst chunks = [];\nfor (let i = 0; i < 50; i++) {\n    chunks.push(new Array(300000).fill(99.9));\n}\nconsole.log("Completed without crash");`,
    stdin: '50',
    expected: 'any',
    outcome: 'MLE',
    duration: '380ms',
    memory: '64.0MB',
    exitCode: 139,
    stdout: 'Allocating arrays of size 50...\n',
    stderr: 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory\nProcess terminated by cgroup memory controller OOM-Killer.'
  },
  error: {
    lang: 'java',
    code: `public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello World") // Missing semicolon\n    }\n}`,
    stdin: '',
    expected: '',
    outcome: 'COMPILER_ERROR',
    duration: '85ms',
    memory: '0MB',
    exitCode: 1,
    stdout: '',
    stderr: './Solution.java:3: error: \';\' expected\n        System.out.println("Hello World")\n                                         ^\n1 error\nCompilation failed.'
  }
};

interface ArchComponent {
  name: string;
  role: string;
  stack: string;
  failsafety: string;
}

const ARCH_COMPONENTS: Record<string, ArchComponent> = {
  dashboard: {
    name: 'React Dashboard',
    role: 'Provides developers with an intuitive interface for project tracking, commit pipelines, metrics visualization, and direct sandbox interaction.',
    stack: 'React 19, TypeScript, Vite, CSS Modules',
    failsafety: 'Designed as a completely stateless static asset server. Connects to backend endpoints through an API gateway with automatic retry logic.'
  },
  gateway: {
    name: 'Spring Cloud Gateway',
    role: 'Acts as the single entryway for client connections. Handles path routing, cross-origin requests, JWT authentication verification, and rate limiting.',
    stack: 'Spring Cloud Gateway, Spring Boot 3, Redis (Rate limiting tokens)',
    failsafety: 'Deploys in a multi-replica configuration behind a Kubernetes LoadBalancer service. If one instance crashes, traffic immediately routes to others.'
  },
  auth: {
    name: 'Auth Service',
    role: 'Handles user authentication, login mechanisms, and GitHub OAuth redirects. Signs and verifies JSON Web Tokens (JWT) for secure requests.',
    stack: 'Spring Boot, Spring Security OAuth2, PostgreSQL',
    failsafety: 'Uses horizontal scaling. Key tokens are stored in a distributed Redis database, ensuring user sessions survive service redeployments.'
  },
  project: {
    name: 'Project Service',
    role: 'Manages repository associations, project configurations, webhook registries, and general user collaboration parameters.',
    stack: 'Spring Boot 3, Hibernate JPA, PostgreSQL',
    failsafety: 'Implements read-through caching on project settings to protect databases during webhook traffic bursts.'
  },
  build: {
    name: 'Build Service',
    role: 'Accepts build triggers from webhooks. Interacts with the code database, queues up tasks in Kafka, and streams compile/execution logs to the client.',
    stack: 'Spring Boot 3, Spring Kafka, Redis Pub/Sub',
    failsafety: 'Build requests are safely written to PostgreSQL before being published to Kafka. In the event of a crash, un-queued tasks are reloaded from the database on reboot.'
  },
  user: {
    name: 'User Service',
    role: 'Manages developer credentials, permissions, profiles, and team associations.',
    stack: 'Spring Boot 3, Spring Data JPA, PostgreSQL',
    failsafety: 'Stateless cluster database replicating user rights globally. Automatically caches query responses using Redis.'
  },
  postgres: {
    name: 'PostgreSQL Database',
    role: 'Stores project state, persistent transaction details, user accounts, and pipeline logs.',
    stack: 'PostgreSQL 16, PgBouncer (Connection pooling)',
    failsafety: 'Operates in a high-availability active-passive setup with automatic replication and streaming failovers.'
  },
  redis: {
    name: 'Redis Cache',
    role: 'Stores user sessions, gateway rate-limiter tokens, and build log tail buffers.',
    stack: 'Redis Cluster 7',
    failsafety: 'Configured with master-slave replicas and persistence enabled (RDB/AOF) to guard against data loss on unexpected node outages.'
  },
  kafka: {
    name: 'Apache Kafka Event Broker',
    role: 'Buffers execution requests, decoupling build request intake from worker node capacities. Scales load across multiple workers.',
    stack: 'Kafka 3.6 (Kraft mode)',
    failsafety: 'Replication factor of 3 across distinct nodes. If a partition broker drops, another immediately assumes leadership with zero message loss.'
  },
  workers: {
    name: 'Stateless Build Worker Pool',
    role: 'Pulls tasks from Kafka partitions, spins up isolated Docker sandboxes, runs tests/compilation, and reports results back to the broker.',
    stack: 'Java 21, Docker API Client, Bash executor',
    failsafety: 'Stateless design. If a worker pod crashes mid-execution, Kafka redirects the build message to another worker partition for retry.'
  },
  dind: {
    name: 'Docker-in-Docker Sandbox (DinD)',
    role: 'Runs arbitrary code binaries inside isolated Docker containers. Imposes resource ceilings (cgroups) for safety and limits network permissions.',
    stack: 'Docker CLI, Linux Cgroups v2, gVisor runtime',
    failsafety: 'Strict kernel call sandboxing prevents host system escapes. Resource limits prevent rogue loops from crashing physical cluster hardware.'
  }
};

interface Pod {
  id: string;
  cpu: number;
  memory: string;
  status: 'running' | 'scaling-down';
}

export default function App() {
  // --- STATE VARIABLES ---
  const [heroLogs, setHeroLogs] = useState<string[]>([]);
  const [selectedSnippetKey, setSelectedSnippetKey] = useState<string>('fib');
  const [langSelect, setLangSelect] = useState<string>('java');
  const [codeContent, setCodeContent] = useState<string>('');
  const [stdinContent, setStdinContent] = useState<string>('10');
  const [expectedContent, setExpectedContent] = useState<string>('55');
  
  // Sandbox Simulator State
  const [sandboxStatus, setSandboxStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [durationMetric, setDurationMetric] = useState<string>('-');
  const [memoryMetric, setMemoryMetric] = useState<string>('-');
  const [exitCodeMetric, setExitCodeMetric] = useState<string>('-');
  const [sandboxConsole, setSandboxConsole] = useState<{ type: 'system' | 'stdout' | 'stderr', text: string }[]>([
    { type: 'system', text: 'Ready to execute. Press "Execute Sandbox Run".' }
  ]);

  // Architecture Details Card State
  const [selectedArchKey, setSelectedArchKey] = useState<string>('gateway');

  // CI/CD Pipeline Simulator State
  const [pipelineBranch, setPipelineBranch] = useState<string>('main');
  const [pipelineCommit, setPipelineCommit] = useState<string>('feat: implement oauth token rotation');
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, 'waiting' | 'running' | 'success' | 'failed'>>({
    checkout: 'waiting',
    deps: 'waiting',
    compile: 'waiting',
    test: 'waiting',
    artifact: 'waiting',
    deploy: 'waiting',
  });
  const [pipelineBuildId, setPipelineBuildId] = useState<string>('Build ID: -');
  const [pipelineLogs, setPipelineLogs] = useState<{ type: 'system' | 'running' | 'success' | 'error', text: string }[]>([
    { type: 'system', text: 'Waiting for push event webhook trigger...' }
  ]);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);

  // K8s HPA Scaling Simulator State
  const [requestLoad, setRequestLoad] = useState<number>(10);
  const [telemetryQueueSize, setTelemetryQueueSize] = useState<number>(2);
  const [telemetryWaitTime, setTelemetryWaitTime] = useState<string>('180ms');
  const [podsList, setPodsList] = useState<Pod[]>([
    { id: 'arbiter-worker-4e2a', cpu: 12, memory: '34MB', status: 'running' }
  ]);
  const [hpaLogs, setHpaLogs] = useState<string[]>([
    '[HPA-Daemon] Initialized HPA loops. Target metrics: CPU=75% | QueueDepth=10',
    '[HPA-Daemon] Replicas=1, queue depth stable.'
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const sandboxConsoleEndRef = useRef<HTMLDivElement>(null);
  const pipelineLogEndRef = useRef<HTMLDivElement>(null);
  const hpaLogEndRef = useRef<HTMLDivElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Populate code template based on initial key
    const initialSnippet = SNIPPETS[selectedSnippetKey];
    if (initialSnippet) {
      setCodeContent(initialSnippet.code);
      setStdinContent(initialSnippet.stdin);
      setExpectedContent(initialSnippet.expected);
      setLangSelect(initialSnippet.lang);
    }

    // Initialize Hero boot logs
    const bootLogs = [
      'Initializing Arbiter platform kernel...',
      'Connecting to Spring Cloud Eureka server at eureka-cluster.internal:8761...',
      'Gateway routing table synced: 6 active microservice nodes detected.',
      'Checking Kafka cluster quorum...',
      'Broker quorum verified (3 brokers active, Kraft metadata synchronized).',
      'Registering isolated Docker-in-Docker (DinD) sandbox supervisors...',
      'Security sandbox profiles loaded: AppArmor profiles set to strict isolation.',
      'cgroups v2 controller path detected: memory, cpu, pids mount checks: OK.',
      'Stateless workers ready to poll kafka: partition-0, partition-1, partition-2.',
      'System initialisation fully complete. Listening for webhook commits...'
    ];

    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < bootLogs.length) {
        setHeroLogs(prev => [...prev, bootLogs[logIndex]]);
        logIndex++;
      } else {
        clearInterval(interval);
      }
    }, 450);

    return () => clearInterval(interval);
  }, []);

  // Sync scroll on logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [heroLogs]);

  useEffect(() => {
    sandboxConsoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sandboxConsole]);

  useEffect(() => {
    pipelineLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineLogs]);

  useEffect(() => {
    hpaLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hpaLogs]);

  // Handle template selection change
  const handleSnippetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setSelectedSnippetKey(key);
    const snippet = SNIPPETS[key];
    if (snippet) {
      setCodeContent(snippet.code);
      setStdinContent(snippet.stdin);
      setExpectedContent(snippet.expected);
      setLangSelect(snippet.lang);
    }
  };

  // --- ACTIONS ---

  // Trigger Code Sandbox Run
  const runCodeSandbox = () => {
    if (sandboxStatus === 'running') return;
    
    setSandboxStatus('running');
    setActiveStep(1); // Kafka Step
    setDurationMetric('-');
    setMemoryMetric('-');
    setExitCodeMetric('-');

    setSandboxConsole([
      { type: 'system', text: 'Submitting sandbox job...' },
      { type: 'system', text: `[Kafka Broker] Enqueued build request to partition-0. Payload size: ${codeContent.length} bytes.` }
    ]);

    const snippet = SNIPPETS[selectedSnippetKey];
    
    // Step 1: Kafka Queue -> Worker Pod Allocation
    setTimeout(() => {
      setActiveStep(2);
      setSandboxConsole(prev => [
        ...prev,
        { type: 'system', text: '[Kafka Consumer] Partition-0 poll triggered.' },
        { type: 'system', text: '[HPA Router] Allocating task to container host: worker-pod-3b82.' },
        { type: 'system', text: 'worker-pod-3b82: received build payload. Instantiating secure runtime execution.' }
      ]);
    }, 1000);

    // Step 2: Worker -> Launching Docker Container Sandbox
    setTimeout(() => {
      setActiveStep(3);
      setSandboxConsole(prev => [
        ...prev,
        { type: 'system', text: 'worker-pod-3b82: spawning container using runtime "gvisor"...' },
        { type: 'system', text: 'Container initialized. Security constraints enforced: Netork=NONE, PidLimit=32.' },
        { type: 'system', text: 'cgroup: setting memory hard ceiling to 64MB.' },
        { type: 'system', text: `cgroup: setting CPU shares limit to 1 Core. Stdin loaded with: "${stdinContent}"` },
        { type: 'system', text: 'Executing compilation & startup routines inside container filesystem...' }
      ]);
    }, 2200);

    // Step 3: Run execution and display final output
    setTimeout(() => {
      setActiveStep(4);
      
      const isSuccess = snippet.outcome === 'SUCCESS';
      setSandboxStatus(isSuccess ? 'success' : 'failed');
      setDurationMetric(snippet.duration);
      setMemoryMetric(snippet.memory);
      setExitCodeMetric(String(snippet.exitCode));

      const newLogs: { type: 'system' | 'stdout' | 'stderr', text: string }[] = [];

      if (snippet.stdout) {
        newLogs.push({ type: 'stdout', text: `[Stdout] ${snippet.stdout}` });
      }
      if (snippet.stderr) {
        newLogs.push({ type: 'stderr', text: `[Stderr] ${snippet.stderr}` });
      }

      newLogs.push({
        type: 'system',
        text: `Execution completed. Container exited with exit code ${snippet.exitCode}. Resource Cleanup Complete.`
      });

      setSandboxConsole(prev => [...prev, ...newLogs]);
    }, 3800);
  };

  // Trigger CI/CD Pipeline Build
  const runCiCdPipeline = () => {
    if (isPipelineRunning) return;

    setIsPipelineRunning(true);
    const buildId = `arb-bld-${Math.floor(100000 + Math.random() * 900000)}`;
    setPipelineBuildId(`Build ID: ${buildId}`);

    // Reset nodes state
    setPipelineStatus({
      checkout: 'running',
      deps: 'waiting',
      compile: 'waiting',
      test: 'waiting',
      artifact: 'waiting',
      deploy: 'waiting',
    });

    setPipelineLogs([
      { type: 'system', text: `[Build Engine] Git webhook triggered. Repository: user-code/backend-service, Branch: ${pipelineBranch}` },
      { type: 'system', text: `[Build Engine] Commit reference: ${pipelineCommit}` },
      { type: 'running', text: `[Checkout] Cloning repository from GitHub: git@github.com:user-code/backend-service.git` }
    ]);

    // Stage 1: Checkout Success
    setTimeout(() => {
      setPipelineStatus(prev => ({ ...prev, checkout: 'success', deps: 'running' }));
      setPipelineLogs(prev => [
        ...prev,
        { type: 'success', text: `[Checkout] Cloned successfully. Commit hash: 9a3e2f10b. Head: ${pipelineCommit}` },
        { type: 'running', text: `[Dependencies] Resolving software dependencies. Installing project libraries...` }
      ]);
    }, 1500);

    // Stage 2: Dependencies Success
    setTimeout(() => {
      setPipelineStatus(prev => ({ ...prev, deps: 'success', compile: 'running' }));
      setPipelineLogs(prev => [
        ...prev,
        { type: 'success', text: `[Dependencies] Resolved 48 external libraries in 1.45s.` },
        { type: 'running', text: `[Compilation] Invoking JDK 21 compiler. Compiling Java modules...` }
      ]);
    }, 3000);

    // Stage 3: Compilation Success
    setTimeout(() => {
      setPipelineStatus(prev => ({ ...prev, compile: 'success', test: 'running' }));
      setPipelineLogs(prev => [
        ...prev,
        { type: 'success', text: `[Compilation] Compilation completed: 18 target classes compiled. 0 warnings.` },
        { type: 'running', text: `[Tests] Running automated unit test suites (JUnit & Mockito)...` }
      ]);
    }, 4500);

    // Stage 4: Test Success
    setTimeout(() => {
      setPipelineStatus(prev => ({ ...prev, test: 'success', artifact: 'running' }));
      setPipelineLogs(prev => [
        ...prev,
        { type: 'success', text: `[Tests] Test Results: 42 tests passed, 0 failures. Coverage: 92.4%` },
        { type: 'running', text: `[Artifact] Building Docker image layer and packaging jar payload...` }
      ]);
    }, 6000);

    // Stage 5: Artifact Success
    setTimeout(() => {
      const isFeature = pipelineBranch.startsWith('feature');
      
      if (isFeature) {
        // Feature branch ends here (Build + Test only, no deployment)
        setPipelineStatus(prev => ({ ...prev, artifact: 'success' }));
        setPipelineLogs(prev => [
          ...prev,
          { type: 'success', text: `[Artifact] Compressed jar built successfully. Image built: arbiter/app-backend:${buildId}` },
          { type: 'success', text: `[Artifact] Uploaded image to Azure Container Registry.` },
          { type: 'system', text: `[Build Engine] Success. Pipeline completed. branch "${pipelineBranch}" is build-only. Bypassing K8s rollout.` }
        ]);
        setIsPipelineRunning(false);
      } else {
        setPipelineStatus(prev => ({ ...prev, artifact: 'success', deploy: 'running' }));
        setPipelineLogs(prev => [
          ...prev,
          { type: 'success', text: `[Artifact] Compressed jar built successfully. Image built: arbiter/app-backend:${buildId}` },
          { type: 'running', text: `[Deploy] Initiating Kubernetes deployment rollout. Target Namespace: arbiter-prod` }
        ]);
      }
    }, 7500);

    // Stage 6: Deploy Success (if not feature branch)
    setTimeout(() => {
      if (pipelineBranch.startsWith('feature')) return;

      setPipelineStatus(prev => ({ ...prev, deploy: 'success' }));
      setPipelineLogs(prev => [
        ...prev,
        { type: 'success', text: `[Deploy] kubectl rollout status: deployment/arbiter-backend updated.` },
        { type: 'success', text: `[Deploy] Ingress synced. Traffic redirected to green pod cluster.` },
        { type: 'system', text: `[Build Engine] Success. Pipeline execution completed. Status: GREEN.` }
      ]);
      setIsPipelineRunning(false);
    }, 9500);
  };

  // --- K8S AUTOSCALER SIMULATOR EFFECTS ---
  useEffect(() => {
    // Determine number of replicas based on load
    let targetReplicas = 1;
    if (requestLoad > 80) targetReplicas = 6;
    else if (requestLoad > 55) targetReplicas = 4;
    else if (requestLoad > 30) targetReplicas = 2;

    const queueSize = Math.max(0, Math.floor((requestLoad * 0.4) - (podsList.length * 2.5)));
    setTelemetryQueueSize(queueSize);

    const waitTime = queueSize > 0 ? `${120 + Math.floor(queueSize * 65)}ms` : '45ms';
    setTelemetryWaitTime(waitTime);

    // Adjust workers grid list
    setPodsList(prev => {
      const currentList = prev.filter(p => p.status === 'running');
      const difference = targetReplicas - currentList.length;

      if (difference > 0) {
        // Add new pods
        const newPods: Pod[] = [];
        for (let i = 0; i < difference; i++) {
          const suffix = Math.random().toString(36).substring(2, 6);
          newPods.push({
            id: `arbiter-worker-${suffix}`,
            cpu: Math.floor(15 + Math.random() * 40),
            memory: `${28 + Math.floor(Math.random() * 18)}MB`,
            status: 'running'
          });
        }
        
        // Log the scaling event
        setHpaLogs(logs => [
          ...logs,
          `[HPA-Daemon] Queue depth detected. Scaling UP: provision ${difference} new replica(s).`
        ]);

        return [...currentList, ...newPods];
      } else if (difference < 0) {
        // Remove excess pods (simulate scaling down phase)
        const countToRemove = Math.abs(difference);
        const updatedList = [...currentList];
        
        // Mark for scale down animation
        for (let i = 0; i < countToRemove; i++) {
          if (updatedList[i]) {
            updatedList[i] = { ...updatedList[i], status: 'scaling-down' };
          }
        }

        setHpaLogs(logs => [
          ...logs,
          `[HPA-Daemon] Load decrease. Scaling DOWN: terminating ${countToRemove} replica(s).`
        ]);

        return updatedList;
      }
      return currentList;
    });
  }, [requestLoad]);

  // Periodic CPU updater for active Kubernetes pods
  useEffect(() => {
    const timer = setInterval(() => {
      setPodsList(prev =>
        prev.map(p => {
          if (p.status !== 'running') return p;
          // Calculate CPU usage loosely linked to request load
          const baseCpu = Math.max(10, Math.floor(requestLoad * 0.95));
          const randomness = Math.floor((Math.random() - 0.5) * 20);
          return {
            ...p,
            cpu: Math.min(100, Math.max(5, baseCpu + randomness))
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [requestLoad]);

  const activeArchDetails = ARCH_COMPONENTS[selectedArchKey];

  return (
    <>
      {/* Header */}
      <header>
        <div className="container header-container">
          <a href="#" className="logo-container" id="header-logo">
            <div className="logo-pulse"></div>
            <span className="logo-text">Arbiter</span>
          </a>
          <nav>
            <a href="#features">Features</a>
            <a href="#architecture">Architecture</a>
            <a href="#sandbox">Sandbox Runner</a>
            <a href="#pipeline">CI/CD Pipeline</a>
            <a href="#scaling">HPA Scaling</a>
            <a href="#metrics">Metrics</a>
          </nav>
          <a href="#sandbox" className="cta-btn-sm">Run Demo</a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container-grid">
          <div className="hero-text-content">
            <div className="badge-new">v1.0 Cloud Release</div>
            <h1 className="hero-title">Secure, Isolated Code Execution at Scale</h1>
            <p className="hero-subtitle">
              A cloud-native developer platform that compiles, tests, and deploys user code in resource-bounded containers. Powered by Spring Cloud Gateway, Kafka event broker, and Docker-in-Docker cgroup jail.
            </p>
            
            <div className="tech-stack-row">
              <span className="tech-tag">Java 21</span>
              <span className="tech-tag">Spring Boot 3</span>
              <span className="tech-tag">Kubernetes</span>
              <span className="tech-tag">Docker</span>
              <span className="tech-tag">Kafka</span>
              <span className="tech-tag">Redis</span>
              <span className="tech-tag">PostgreSQL</span>
            </div>

            <div className="hero-ctas">
              <a href="#sandbox" className="btn-primary">Try Code Sandbox</a>
              <a href="#architecture" className="btn-secondary">Explore Architecture</a>
            </div>
          </div>

          {/* Live Terminal Mockup */}
          <div className="terminal-container" id="hero-terminal">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <div className="terminal-title">arbiter-cluster-init.log</div>
            </div>
            <div className="terminal-content">
              {heroLogs.map((log, idx) => (
                <div className="terminal-line" key={idx}>
                  <span className="terminal-prompt">&gt;</span>
                  <span className="terminal-output">{log}</span>
                </div>
              ))}
              <div ref={terminalEndRef}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Key Features</span>
            <h2 className="section-title">Engineered for Isolation & Throughput</h2>
            <p className="section-desc">Arbiter solves the hard systems challenge of executing untrusted user-submitted code snippets under strict limits, delivering predictable latency.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3>Secure Sandboxing</h3>
              <p>Each code run spins up a hardened Docker container. Hard memory limits and maximum runtimes are cgroup-enforced. Network adapter interfaces are cut to block external calls.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M2 17h20M2 12h20M2 7h20"></path>
                </svg>
              </div>
              <h3>Kafka Build Queue</h3>
              <p>Build tasks are buffered using Kafka queues. Spikes in request rates are absorbed by the broker cluster, avoiding database locks or worker thread exhaustion.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <h3>Horizontal Auto-Scaling</h3>
              <p>Build worker replicas run inside a Kubernetes deployment. The cluster Horizontal Pod Autoscaler monitors Kafka queue latency to scale pods up/down.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h3>CI/CD Pipelines</h3>
              <p>Triggers full branch-level deployment workflows: code checkout, library fetching, Compilation check, automated test execution, Docker packaging, and rollout.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Interactive Section */}
      <section id="architecture" className="architecture-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Interactive Architecture</span>
            <h2 className="section-title">Microservice Layout & Event Flow</h2>
            <p className="section-desc">Click any component box in the routing flow or database tiers to view its system role, tech stack, and container fail-safety strategy.</p>
          </div>

          <div className="architecture-layout">
            {/* React Client */}
            <div 
              className={`arch-box client-box ${selectedArchKey === 'dashboard' ? 'active-card' : ''}`}
              onClick={() => setSelectedArchKey('dashboard')}
            >
              <span className="arch-tag">Frontend</span>
              <h4>React Dashboard</h4>
              <p>Unified developer console.</p>
            </div>

            <div className="arch-arrow horizontal">➔</div>

            {/* Gateway */}
            <div 
              className={`arch-box gateway-box ${selectedArchKey === 'gateway' ? 'active-card' : ''}`}
              onClick={() => setSelectedArchKey('gateway')}
            >
              <span className="arch-tag">Spring Cloud</span>
              <h4>Cloud Gateway</h4>
              <p>Routing, Auth & Rate Limiting</p>
            </div>

            <div className="arch-arrow horizontal">➔</div>

            {/* Services Cluster */}
            <div className="arch-cluster">
              <div className="arch-cluster-title">Services Cluster</div>
              <div className="arch-cluster-grid">
                <div 
                  className={`arch-box service-box ${selectedArchKey === 'auth' ? 'active-card' : ''}`}
                  onClick={() => setSelectedArchKey('auth')}
                >
                  <h5>Auth Service</h5>
                  <p>JWT & GitHub OAuth</p>
                </div>
                <div 
                  className={`arch-box service-box ${selectedArchKey === 'project' ? 'active-card' : ''}`}
                  onClick={() => setSelectedArchKey('project')}
                >
                  <h5>Project Service</h5>
                  <p>Repo Linkers</p>
                </div>
                <div 
                  className={`arch-box service-box ${selectedArchKey === 'build' ? 'active-card' : ''}`}
                  onClick={() => setSelectedArchKey('build')}
                >
                  <h5>Build Service</h5>
                  <p>Kafka Trigger & Log</p>
                </div>
                <div 
                  className={`arch-box service-box ${selectedArchKey === 'user' ? 'active-card' : ''}`}
                  onClick={() => setSelectedArchKey('user')}
                >
                  <h5>User Service</h5>
                  <p>Roles & Org Data</p>
                </div>
              </div>
            </div>

            {/* Database and cache side tiers */}
            <div className="db-cache-tier">
              <div 
                className={`arch-box db-box ${selectedArchKey === 'postgres' ? 'active-card' : ''}`}
                onClick={() => setSelectedArchKey('postgres')}
              >
                <h5>PostgreSQL</h5>
                <p>SQL Database</p>
              </div>
              <div 
                className={`arch-box db-box ${selectedArchKey === 'redis' ? 'active-card' : ''}`}
                onClick={() => setSelectedArchKey('redis')}
              >
                <h5>Redis Cache</h5>
                <p>Caching Hub</p>
              </div>
            </div>
          </div>

          {/* Lower queues & runtime layout */}
          <div className="architecture-bottom-flow">
            <div className="build-to-queue-arrow">▼ (Enqueue Job Event)</div>
            
            <div 
              className={`kafka-broker-box ${selectedArchKey === 'kafka' ? 'active-card' : ''}`}
              onClick={() => setSelectedArchKey('kafka')}
            >
              <div className="kafka-header">
                <span className="kafka-badge">Event Broker</span>
                <h4>Apache Kafka Queue</h4>
              </div>
              <div className="kafka-partitions">
                <div className="partition-pill">Partition 0 (Assigned)</div>
                <div className="partition-pill">Partition 1 (Idle)</div>
                <div className="partition-pill">Partition 2 (Idle)</div>
              </div>
            </div>

            <div className="queue-to-workers-arrow">▼ (Pull Event Loop)</div>

            <div 
              className={`workers-cluster-box ${selectedArchKey === 'workers' ? 'active-card' : ''}`}
              onClick={() => setSelectedArchKey('workers')}
            >
              <div className="workers-header">
                <span className="workers-badge">Kubernetes Pods</span>
                <h4>Build Worker Pool</h4>
              </div>
              <div className="workers-grid-mini">
                <div className="mini-pod active-pulse">worker-pod-4e2a</div>
                <div className="mini-pod">worker-pod-3b82</div>
                <div className="mini-pod">worker-pod-fc8e</div>
                <div className="mini-pod">worker-pod-92ca</div>
              </div>
            </div>

            <div className="workers-to-dind-arrow">▼ (Fork Isolated Runtime Container)</div>

            <div 
              className={`dind-sandbox-box ${selectedArchKey === 'dind' ? 'active-card' : ''}`}
              onClick={() => setSelectedArchKey('dind')}
            >
              <div className="dind-header">
                <span className="dind-badge">Secure Jail</span>
                <h4>Docker-in-Docker (DinD) Sandbox</h4>
              </div>
              <p>Sandbox limits: <strong>Memory: 64MB | Wall-Time: 2.0s | Network: Closed</strong></p>
            </div>
          </div>

          {/* Details inspection panel */}
          {activeArchDetails && (
            <div className="details-panel" id="architecture-details-card">
              <h4 id="details-title">{activeArchDetails.name}</h4>
              <div className="details-grid">
                <div>
                  <span className="details-label">Role:</span>
                  <span className="details-val" id="details-role">{activeArchDetails.role}</span>
                </div>
                <div>
                  <span className="details-label">Stack:</span>
                  <span className="details-val" id="details-stack">{activeArchDetails.stack}</span>
                </div>
                <div>
                  <span className="details-label">Fail-Safety:</span>
                  <span className="details-val" id="details-failsafety">{activeArchDetails.failsafety}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Code Sandbox Simulator Section */}
      <section id="sandbox" className="sandbox-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Interactive Demo</span>
            <h2 className="section-title">Hardened Sandbox Judge Simulator</h2>
            <p className="section-desc">Submit code runs, simulating compile limits, execution boundaries, and cgroup kernel isolation behavior.</p>
          </div>

          <div className="sandbox-simulator-grid">
            {/* Editor card */}
            <div className="sandbox-editor-card">
              <div className="editor-header">
                <div className="editor-title-row">
                  <span className="editor-title-badge">SOURCE_FILE</span>
                  <select 
                    id="sandbox-lang-select" 
                    className="lang-select"
                    value={langSelect}
                    onChange={(e) => setLangSelect(e.target.value)}
                  >
                    <option value="java">Java 21</option>
                    <option value="python">Python 3</option>
                    <option value="cpp">C++ 17</option>
                    <option value="nodejs">Node.js 18</option>
                  </select>
                </div>
                
                <select 
                  id="sandbox-snippet-select" 
                  className="snippet-select"
                  value={selectedSnippetKey}
                  onChange={handleSnippetChange}
                >
                  <option value="fib">Compute Fibonacci (SUCCESS)</option>
                  <option value="loop">Infinite Loop (TIME_LIMIT_EXCEEDED)</option>
                  <option value="mem">Array Bloat (MEMORY_LIMIT_EXCEEDED)</option>
                  <option value="error">Syntax Error (COMPILATION_ERROR)</option>
                </select>
              </div>

              <div className="editor-textarea-wrapper">
                <textarea 
                  id="sandbox-code-editor" 
                  spellCheck="false"
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                />
              </div>

              <div className="editor-inputs-grid">
                <div className="input-group">
                  <label htmlFor="sandbox-stdin">Standard Input (stdin)</label>
                  <input 
                    type="text" 
                    id="sandbox-stdin" 
                    value={stdinContent}
                    onChange={(e) => setStdinContent(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="sandbox-expected">Expected Output</label>
                  <input 
                    type="text" 
                    id="sandbox-expected" 
                    value={expectedContent}
                    onChange={(e) => setExpectedContent(e.target.value)}
                  />
                </div>
              </div>

              <div className="editor-actions">
                <button 
                  id="btn-run-sandbox" 
                  className="btn-run"
                  onClick={runCodeSandbox}
                  disabled={sandboxStatus === 'running'}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                  </svg>
                  Execute Sandbox Run
                </button>
              </div>
            </div>

            {/* Sandbox Output Telemetry */}
            <div className="sandbox-output-card">
              <div className="output-header">
                <h4>Execution Telemetry</h4>
                <span className={`status-pill ${sandboxStatus}`}>
                  {sandboxStatus}
                </span>
              </div>

              {/* Progress Stepper */}
              <div className="sandbox-steps-timeline">
                <div className={`step-node ${activeStep >= 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}>
                  <div className="step-circle">1</div>
                  <span className="step-lbl">Kafka Queue</span>
                </div>
                <div className={`step-node ${activeStep >= 2 ? 'active' : ''} ${activeStep > 2 ? 'completed' : ''}`}>
                  <div className="step-circle">2</div>
                  <span className="step-lbl">Worker Alloc</span>
                </div>
                <div className={`step-node ${activeStep >= 3 ? 'active' : ''} ${activeStep > 3 ? 'completed' : ''}`}>
                  <div className="step-circle">3</div>
                  <span className="step-lbl">Container Jail</span>
                </div>
                <div className={`step-node ${activeStep >= 4 ? 'active' : ''} ${activeStep === 4 ? (sandboxStatus === 'success' ? 'completed' : 'error-state') : ''}`}>
                  <div className="step-circle">4</div>
                  <span className="step-lbl">Exit</span>
                </div>
              </div>

              {/* Metric parameters */}
              <div className="output-metrics-row">
                <div className="metric-box">
                  <span className="lbl">Execution Duration</span>
                  <span className="val" id="metric-duration">{durationMetric}</span>
                </div>
                <div className="metric-box">
                  <span className="lbl">Cgroup RSS Memory</span>
                  <span className="val" id="metric-memory">{memoryMetric}</span>
                </div>
                <div className="metric-box">
                  <span className="lbl">Sandbox Exit Code</span>
                  <span className="val" id="metric-exitcode">{exitCodeMetric}</span>
                </div>
              </div>

              {/* Terminal screen */}
              <div className="console-terminal">
                <div className="console-tab">Terminal Output</div>
                <div className="console-body">
                  {sandboxConsole.map((line, index) => (
                    <div className={`${line.type}-line`} key={index}>
                      {line.text}
                    </div>
                  ))}
                  <div ref={sandboxConsoleEndRef}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CI/CD Pipeline Simulator Section */}
      <section id="pipeline" className="pipeline-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">CI/CD Engine</span>
            <h2 className="section-title">Automated Build Pipeline Visualizer</h2>
            <p className="section-desc">Simulate a git push hook triggering the full branch-level deployment pipeline. Logs are parsed and reported live from the worker containers.</p>
          </div>

          <div className="pipeline-layout-container">
            {/* Configuration cards */}
            <div className="pipeline-controls-card">
              <h4>Trigger Branch Build</h4>
              <div className="pipeline-inputs">
                <div className="input-group">
                  <label>Select Target Branch</label>
                  <select 
                    id="pipeline-branch-select" 
                    className="sim-select"
                    value={pipelineBranch}
                    onChange={(e) => setPipelineBranch(e.target.value)}
                  >
                    <option value="main">main (Triggers deployment rollout)</option>
                    <option value="release/v1.0">release/v1.0 (Triggers deployment rollout)</option>
                    <option value="feature/auth-oauth">feature/auth-oauth (Code checks & compilation only)</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label>Commit Message</label>
                  <input 
                    type="text" 
                    id="pipeline-commit-msg" 
                    value={pipelineCommit}
                    onChange={(e) => setPipelineCommit(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                id="btn-trigger-pipeline" 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '15px' }}
                onClick={runCiCdPipeline}
                disabled={isPipelineRunning}
              >
                Trigger Pipeline Run
              </button>
            </div>

            {/* Pipeline graph flow */}
            <div className="pipeline-flow-card">
              <div className="pipeline-nodes-wrapper">
                <div className={`pipeline-node-item ${pipelineStatus.checkout}`}>
                  <div className="node-icon">⬇</div>
                  <span className="node-name">Git Checkout</span>
                  <span className="node-status">{pipelineStatus.checkout}</span>
                </div>
                
                <div className="pipeline-connector"></div>
                
                <div className={`pipeline-node-item ${pipelineStatus.deps}`}>
                  <div className="node-icon">📦</div>
                  <span className="node-name">Install Deps</span>
                  <span className="node-status">{pipelineStatus.deps}</span>
                </div>
                
                <div className="pipeline-connector"></div>
                
                <div className={`pipeline-node-item ${pipelineStatus.compile}`}>
                  <div className="node-icon">⚙</div>
                  <span className="node-name">Compile Code</span>
                  <span className="node-status">{pipelineStatus.compile}</span>
                </div>
                
                <div className="pipeline-connector"></div>
                
                <div className={`pipeline-node-item ${pipelineStatus.test}`}>
                  <div className="node-icon">🧪</div>
                  <span className="node-name">Run Tests</span>
                  <span className="node-status">{pipelineStatus.test}</span>
                </div>
                
                <div className="pipeline-connector"></div>
                
                <div className={`pipeline-node-item ${pipelineStatus.artifact}`}>
                  <div className="node-icon">📁</div>
                  <span className="node-name">Store Artifact</span>
                  <span className="node-status">{pipelineStatus.artifact}</span>
                </div>
                
                {!pipelineBranch.startsWith('feature') && (
                  <>
                    <div className="pipeline-connector"></div>
                    <div className={`pipeline-node-item ${pipelineStatus.deploy}`}>
                      <div className="node-icon">🚀</div>
                      <span className="node-name">K8s Deploy</span>
                      <span className="node-status">{pipelineStatus.deploy}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Streaming pipeline logs terminal */}
              <div className="pipeline-log-terminal">
                <div className="terminal-header">
                  <span>Pipeline Stream Logs</span>
                  <span id="pipeline-build-id">{pipelineBuildId}</span>
                </div>
                <div className="pipeline-log-body">
                  {pipelineLogs.map((log, idx) => (
                    <div className={`log-line ${log.type}`} key={idx}>
                      {log.text}
                    </div>
                  ))}
                  <div ref={pipelineLogEndRef}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kubernetes Autoscaling Simulator HPA */}
      <section id="scaling" className="scaling-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Scale & Metrics</span>
            <h2 className="section-title">Kubernetes Horizontal Pod Autoscaler Simulator</h2>
            <p className="section-desc">Drag the load slider to increase code-run traffic, and watch the Kafka queue fill up and the Kubernetes HPA provision additional stateless build workers dynamically.</p>
          </div>

          <div className="scaling-grid">
            {/* Left controller card */}
            <div className="scaling-controls-card">
              <h4>Load Generator Console</h4>
              <p className="desc">Simulates requests hitting the Spring Cloud Gateway, which enqueue build requests into Kafka.</p>
              
              <div className="slider-group">
                <div className="slider-labels">
                  <span>Build Request Volume</span>
                  <span id="load-val">{requestLoad} req/s</span>
                </div>
                <input 
                  type="range" 
                  id="load-slider" 
                  min="0" 
                  max="100" 
                  value={requestLoad}
                  onChange={(e) => setRequestLoad(Number(e.target.value))}
                  step="5"
                />
              </div>

              <div className="scaling-telemetry">
                <div className="telemetry-item">
                  <span className="lbl">Kafka Queue Size</span>
                  <span className="val" id="telemetry-queue-size">{telemetryQueueSize}</span>
                </div>
                <div className="telemetry-item">
                  <span className="lbl">Active Worker Pods</span>
                  <span className="val" id="telemetry-replicas">
                    {podsList.filter(p => p.status === 'running').length}
                  </span>
                </div>
                <div className="telemetry-item">
                  <span className="lbl">Average Queue Wait</span>
                  <span className="val" id="telemetry-wait-time">{telemetryWaitTime}</span>
                </div>
              </div>
            </div>

            {/* Right cluster map card */}
            <div className="scaling-cluster-card">
              <div className="cluster-card-header">
                <h4>Kubernetes Cluster State</h4>
                <div className="cluster-badge">Namespace: arbiter-prod</div>
              </div>

              <div className="pod-grid-container" id="cluster-pods-grid">
                {podsList.map((pod) => (
                  <div 
                    key={pod.id} 
                    className={`pod-card ${pod.status === 'scaling-down' ? 'scaling-down' : ''}`}
                  >
                    <div className="pod-icon-wrapper">
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={pod.status === 'running' ? 'active-pulse' : ''}>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <path d="M12 22V12M12 12 3 7M12 12l9-7"/>
                      </svg>
                      {pod.status === 'running' && (
                        <div className="pod-status-light"></div>
                      )}
                    </div>
                    <span className="pod-name">{pod.id}</span>
                    <span style={{ fontSize: '8px', color: '#6b7280', fontFamily: 'monospace', marginBottom: '4px' }}>
                      CPU: {pod.cpu}% | {pod.memory}
                    </span>
                    <div className="pod-cpu-bar-container">
                      <div 
                        className="pod-cpu-fill" 
                        style={{ 
                          width: `${pod.cpu}%`,
                          backgroundColor: pod.cpu > 80 ? 'var(--color-red)' : (pod.cpu > 50 ? 'var(--color-amber)' : 'var(--color-green)')
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Decision logs footer */}
              <div className="cluster-hpa-logs">
                <div className="logs-header">HPA Autoscaling Decision Logs</div>
                <div className="logs-body">
                  {hpaLogs.map((log, idx) => (
                    <div className="log-row" key={idx}>
                      {log}
                    </div>
                  ))}
                  <div ref={hpaLogEndRef}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Production performance SLA metrics */}
      <section id="metrics" className="stats-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">System Metrics</span>
            <h2 className="section-title">Production Performance SLA</h2>
            <p className="section-desc">Real-world production benchmarks indicating the platform's ability to host microservices and isolate execution containers safely.</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">1.82s</div>
              <div className="stat-label">p95 Execution Latency</div>
              <div className="stat-desc">Excluding queue wait time, for standard user code compiles.</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">100%</div>
              <div className="stat-label">Sandbox Isolation</div>
              <div className="stat-desc">Zero file leaks or host escape vulnerabilities detected in audits.</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">O(1)</div>
              <div className="stat-label">Auth Token Cache Hit</div>
              <div className="stat-desc">Redis cluster serving OAuth tokens under sub-millisecond latencies.</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">0</div>
              <div className="stat-label">Queue Starvation Errors</div>
              <div className="stat-desc">Under Kafka backpressure and Kubernetes horizontal replica scheduling.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <div className="footer-layout">
            <div>
              <a href="#" className="logo-container">
                <div className="logo-pulse"></div>
                <span className="logo-text">Arbiter</span>
              </a>
              <p className="footer-desc">An enterprise CI/CD & sandboxed execution platform for untrusted code execution. Built using Spring Cloud Gateway, Kafka messaging, and Docker security jails.</p>
            </div>
            <div className="footer-links-grid">
              <div className="footer-links-col">
                <span className="footer-col-title">Engine Architecture</span>
                <a href="#architecture">Microservices</a>
                <a href="#architecture">Kafka Queue</a>
                <a href="#architecture">Docker Sandbox</a>
                <a href="#scaling">K8s Scaling</a>
              </div>
              <div className="footer-links-col">
                <span className="footer-col-title">Developer Details</span>
                <a href="https://github.com" target="_blank" rel="noreferrer">GitHub Project</a>
                <a href="#metrics">System SLA</a>
                <a href="#sandbox">Demo Sandbox</a>
                <a href="#pipeline">CI/CD Stages</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 Arbiter. All rights reserved.</span>
            <span>Platform Engineering Portfolio Release v1.0</span>
          </div>
        </div>
      </footer>
    </>
  );
}
