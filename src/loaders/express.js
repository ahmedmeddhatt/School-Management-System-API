const express = require('express');
const authRouter     = require('../api/auth');
const schoolRouter   = require('../api/school');
const classroomRouter = require('../api/classroom');
const studentRouter  = require('../api/student');
const errorHandler   = require('../mws/errorHandler');

module.exports = (app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ ok: true, status: 'healthy' }));

  app.use('/auth',           authRouter);
  app.use('/api/schools',    schoolRouter);
  app.use('/api/classrooms', classroomRouter);
  app.use('/api/students',   studentRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Route not found' }));

  // Axion-style global error handler
  app.use(errorHandler);
};
