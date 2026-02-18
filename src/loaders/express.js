const express = require('express');
const schoolRouter = require('../api/school');
const classroomRouter = require('../api/classroom');
const studentRouter = require('../api/student');

module.exports = (app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/schools', schoolRouter);
  app.use('/api/classrooms', classroomRouter);
  app.use('/api/students', studentRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

  // Global error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });
};
