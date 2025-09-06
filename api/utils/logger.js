const winston = require('winston');
const path = require('path');
const { combine, timestamp, printf, colorize, align, json, errors } = winston.format;

// Define log levels with colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Set the current log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston to add colors
winston.addColors(colors);

// Custom format for console output
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  errors({ stack: true }),
  align(),
  printf(
    (info) =>
      `${info.timestamp} ${info.level}: ${info.message} ${
        info.stack ? `\n${info.stack}` : ''
      }`
  )
);

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { 
    service: 'eventhub-api',
    env: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    })
  );
}

// Create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;